from flask import request, jsonify
import pandas as pd
import joblib

# 1. Importa a factory e os modelos do seu próprio projeto
# (Ajuste "backend_api.app" se o seu __init__.py estiver em outro diretório)
from backend_api.app import create_app 
from database.models import db, Telemetria, Veiculo

# 2. Inicializa o App com a configuração correta do banco (PostgreSQL)
app = create_app()

print("Carregando modelo e scaler...")
modelo = joblib.load('ml_pipeline/fleetguard_model.joblib')
scaler = joblib.load('ml_pipeline/fleetguard_scaler.joblib')

frota_buffer = {}

@app.route('/api/telemetria', methods=['POST'])
def receber_telemetria():
    dados = request.json
    vid = dados.get('veiculo_id')
    
    # --- A. Buffer de Memória e Engenharia de Features ---
    if vid not in frota_buffer:
        frota_buffer[vid] = []
        
    frota_buffer[vid].append(dados)
    
    if len(frota_buffer[vid]) > 30:
        frota_buffer[vid].pop(0)
        
    df_buffer = pd.DataFrame(frota_buffer[vid])
    
    features_temporais = ['temp_motor_spn110', 'vibracao_freio', 'temp_cubo_roda_ir']
    for col in features_temporais:
        df_buffer[f'{col}_media_30'] = df_buffer[col].mean()
        df_buffer[f'{col}_std_30'] = df_buffer[col].std() if len(df_buffer) > 1 else 0.0
        
    # --- B. Inferência do Modelo ---
    linha_atual = df_buffer.iloc[[-1]].copy()
    
    colunas_inuteis = ['id', 'veiculo_id', 'timestamp', 'status_porta', 'tensao_bateria_v', 'codigo_erro_scanner', 'target']
    # errors='ignore' previne a quebra da API caso 'id' ou 'target' não venham no JSON
    X_inferencia = linha_atual.drop(columns=colunas_inuteis, errors='ignore')
    
    X_scaled = scaler.transform(X_inferencia)
    predicao = modelo.predict(X_scaled)[0]
    
    # --- C. Persistência no Banco de Dados (NOVO) ---
    # Verifica se o veículo existe para não dar erro de ForeignKey
    veiculo = db.session.get(Veiculo, vid)
    if not veiculo:
        veiculo = Veiculo(id=vid)
        db.session.add(veiculo)
        db.session.commit()

    # Salva a leitura atual na tabela de telemetria
    nova_telemetria = Telemetria(
        veiculo_id=vid,
        timestamp=dados.get('timestamp'),
        velocidade_kmh_spn84=dados.get('velocidade_kmh_spn84'),
        rpm_spn190=dados.get('rpm_spn190'),
        carga_motor_spn92=dados.get('carga_motor_spn92'),
        temp_motor_spn110=dados.get('temp_motor_spn110'),
        pressao_oleo_spn100=dados.get('pressao_oleo_spn100'),
        vibracao_freio=dados.get('vibracao_freio'),
        temp_cubo_roda_ir=dados.get('temp_cubo_roda_ir'),
        status_porta=dados.get('status_porta'),
        tensao_bateria_v=dados.get('tensao_bateria_v'),
        codigo_erro_scanner=dados.get('codigo_erro_scanner'),
        target=predicao  # Salvamos o status previsto pela IA
    )
    
    db.session.add(nova_telemetria)
    db.session.commit()
    
    # --- D. Retorno ---
    return jsonify({
        "veiculo_id": vid,
        "alerta_preditivo": predicao,
        "leituras_no_buffer": len(frota_buffer[vid])
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)