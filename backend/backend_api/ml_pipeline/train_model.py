import os
import sys
import pandas as pd
import joblib
from sqlalchemy import create_engine

from sklearn.model_selection import train_test_split, RandomizedSearchCV, GroupShuffleSplit
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, f1_score
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.utils.class_weight import compute_sample_weight

# Garante que o script enxergue as configurações do banco de dados na pasta backend_api
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
from backend_api.app.config import Config

def treinar_modelos():
    # 1. Carregamento de Dados
    print("1. Conectando ao banco PostgreSQL e extraindo dados...")
    engine = create_engine(Config.SQLALCHEMY_DATABASE_URI)
    
    # Lemos a tabela inteira e depois pegamos uma amostra.
    # Fazer o sample no Pandas é infinitamente mais rápido que usar ORDER BY RANDOM() no SQL.
    df = pd.read_sql("SELECT * FROM telemetria", engine)
    print(f"   -> Total de linhas no banco: {len(df)}")
    print("   -> Utilizando todo o poder de processamento do hardware (Dataset completo!)...")
    # O if com o df.sample() foi removido para treinarmos com todas as ~921 mil linhas

    # 2. Pré-processamento e Engenharia de Features Temporais
    print("\n2. Pré-processando os dados (Limpeza, Features Temporais e Normalização)...")
    
    # a. Ordenar no tempo para garantir a sequência física por veículo
    df = df.sort_values(['veiculo_id', 'timestamp'])
    
    # b. Criar features de memória (Janelas deslizantes de 30 amostras)
    features_temporais = ['temp_motor_spn110', 'vibracao_freio', 'temp_cubo_roda_ir']
    for col in features_temporais:
        df[f'{col}_media_30'] = df.groupby('veiculo_id')[col].transform(lambda x: x.rolling(30, min_periods=1).mean())
        df[f'{col}_std_30'] = df.groupby('veiculo_id')[col].transform(lambda x: x.rolling(30, min_periods=1).std().fillna(0))

    # c. Separação Treino/Teste por VEÍCULO (Evita Data Leakage)
    gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    train_idx, test_idx = next(gss.split(df, df['target'], groups=df['veiculo_id']))
    
    df_train = df.iloc[train_idx].copy()
    df_test = df.iloc[test_idx].copy()

    # d. Calcular pesos para a classe minoritária (Falha Iminente) no treino
    pesos_treino = compute_sample_weight(class_weight='balanced', y=df_train['target'])

    # e. Remover colunas administrativas
    colunas_inuteis = ['id', 'veiculo_id', 'timestamp', 'status_porta', 'tensao_bateria_v', 'codigo_erro_scanner']
    X_train = df_train.drop(columns=[col for col in colunas_inuteis if col in df_train.columns] + ['target'])
    y_train = df_train['target']
    
    X_test = df_test.drop(columns=[col for col in colunas_inuteis if col in df_test.columns] + ['target'])
    y_test = df_test['target']
    
    # f. Normalização
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # 3. Definição dos Modelos e Hiperparâmetros
    print("\n3. Iniciando o treinamento e RandomizedSearchCV (Busca Expandida)...")
    
    modelos = {
        "Random Forest (Balanceado)": {
            "model": RandomForestClassifier(random_state=42, n_jobs=2, class_weight='balanced'),
            "params": {
                "n_estimators": [100, 200, 300],
                "max_depth": [None, 15, 20, 30],
                "min_samples_split": [2, 10, 20]
            },
            "usa_peso_externo": False # O RandomForest já usa o class_weight interno dele
        },
        "HistGradientBoosting (Poder Total)": {
            "model": HistGradientBoostingClassifier(random_state=42),
            "params": {
                "learning_rate": [0.01, 0.05, 0.1],
                "max_iter": [300, 500, 800],
                "max_depth": [None, 15, 25],
                "min_samples_leaf": [20, 50, 100], # Evita que a árvore decore o ruído gaussiano dos sensores
                "l2_regularization": [0.0, 0.1, 1.0]
            },
            "usa_peso_externo": True # Injetaremos os pesos manualmente aqui
        }
    }

    melhor_modelo_nome = ""
    melhor_modelo_obj = None
    melhor_f1 = 0.0

    # 4. Treinamento e Avaliação
    for nome, config in modelos.items():
        print(f"\n--- Treinando {nome} ---")
        
        # Ampliamos para n_iter=20 testes de hiperparâmetros
        search = RandomizedSearchCV(
            config["model"], 
            param_distributions=config["params"], 
            n_iter=20, 
            cv=3, 
            scoring='f1_macro', 
            n_jobs=-1, 
            random_state=42
        )
        
        # Conecta os pesos no .fit() somente se o modelo precisar
        fit_params = {}
        if config["usa_peso_externo"]:
            fit_params['sample_weight'] = pesos_treino

        search.fit(X_train_scaled, y_train, **fit_params)
        modelo_treinado = search.best_estimator_
        
        # Previsão e Métricas
        y_pred = modelo_treinado.predict(X_test_scaled)
        f1 = f1_score(y_test, y_pred, average='weighted')
        
        print(f"Melhores parâmetros encontrados: {search.best_params_}")
        print(f"F1-Score: {f1:.4f}")
        
        if f1 > melhor_f1:
            melhor_f1 = f1
            melhor_modelo_nome = nome
            melhor_modelo_obj = modelo_treinado

    # 5. Relatório Final e Exportação
    print("\n=======================================================")
    print(f"🏆 O GRANDE VENCEDOR: {melhor_modelo_nome} (F1: {melhor_f1:.4f})")
    print("=======================================================\n")
    
    print("Métricas detalhadas do modelo vencedor no conjunto de teste:")
    y_pred_best = melhor_modelo_obj.predict(X_test_scaled)
    print(classification_report(y_test, y_pred_best))
    
    # Exporta o modelo vencedor e o normalizador para a API usar depois
    caminho_modelo = os.path.join(os.path.dirname(__file__), 'fleetguard_model.joblib')
    caminho_scaler = os.path.join(os.path.dirname(__file__), 'fleetguard_scaler.joblib')
    
    joblib.dump(melhor_modelo_obj, caminho_modelo)
    joblib.dump(scaler, caminho_scaler)
    
    print(f"✅ Pipeline concluído! Artefatos salvos em:")
    print(f"   - {caminho_modelo}")
    print(f"   - {caminho_scaler}")

if __name__ == '__main__':
    treinar_modelos()