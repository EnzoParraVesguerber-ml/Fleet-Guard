import pandas as pd
from run import app
from database.models import db, Veiculo

def carregar_banco():
    caminho_csv = 'edge_simulation/data/fleetguard_dataset_mock.csv'
    
    print("1. Lendo o arquivo CSV gigantesco...")
    df = pd.read_csv(caminho_csv)
    
    with app.app_context():
        print("2. Apagando tabelas antigas e criando novas do zero...")
        db.drop_all()
        db.create_all()

        print("3. Cadastrando os veículos únicos...")
        veiculos_ids = df['veiculo_id'].unique()
        for v_id in veiculos_ids:
            if not db.session.get(Veiculo, int(v_id)):
                db.session.add(Veiculo(id=int(v_id)))
        db.session.commit()
        
        print("4. Injetando a telemetria corrigida no PostgreSQL...")
        df.to_sql('telemetria', con=db.engine, if_exists='append', index=False)
        
        print(f"Sucesso! {len(df)} linhas de telemetria perfeitamente formatadas foram salvas.")

if __name__ == '__main__':
    carregar_banco()