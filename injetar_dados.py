import argparse
import time
import requests
import numpy as np
import pandas as pd

from backend.database.models import db, Veiculo
from backend.backend_api.app import create_app


CSV_PATH = 'backend/edge_simulation/data/fleetguard_dataset_mock.csv'
API_URL = 'http://127.0.0.1:5000/api/telemetria'
VEICULO_SIMULADO = 0


def _to_native(d: dict) -> dict:
    """Converte tipos numpy -> tipos nativos do Python (para o json do requests)."""
    out = {}
    for k, v in d.items():
        if hasattr(v, "item"):          # numpy.int64/float64/bool_
            out[k] = v.item()
        else:
            out[k] = v
    return out


def carregar_banco():
    print("1. Lendo o CSV...")
    df = pd.read_csv(CSV_PATH)

    app = create_app()
    with app.app_context():
        print("2. Recriando tabelas...")
        db.drop_all()
        db.create_all()

        print("3. Cadastrando veículos únicos...")
        for v_id in df['veiculo_id'].unique():
            db.session.add(Veiculo(id=int(v_id)))
        db.session.commit()

        print(f"4. Injetando {len(df)} linhas na tabela telemetria...")
        df.to_sql('telemetria', con=db.engine, if_exists='append', index=False)
        print("✅ Carga histórica concluída.")


def simular_ao_vivo():
    print(f"\n5. Simulando ônibus {VEICULO_SIMULADO} em tempo real (Ctrl+C para sair)...")
    df = pd.read_csv(CSV_PATH)
    df_bus = df[df['veiculo_id'] == VEICULO_SIMULADO]

    for _, linha in df_bus.iterrows():
        dados = _to_native(linha.to_dict())
        # NÃO envie a coluna 'target' — ela é o rótulo verdadeiro, a API gera o dela
        dados.pop('target', None)

        try:
            r = requests.post(API_URL, json=dados, timeout=5)
            r.raise_for_status()
            pred = r.json().get("alerta_preditivo", "?")
            print(f"T={dados['timestamp']:>7.1f}s | "
                  f"Temp {dados['temp_motor_spn110']:>6.2f}°C | "
                  f"RPM {dados['rpm_spn190']:>6.1f} | IA: {pred}")
        except requests.exceptions.ConnectionError:
            print("❌ API Flask não está rodando. Inicie `python run.py` em outro terminal.")
            return
        time.sleep(3)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--modo',
        choices=['carregar', 'simular', 'completo'],
        default='completo',
        help="carregar=só popula o banco | simular=só roda a simulação | completo=ambos"
    )
    args = parser.parse_args()

    if args.modo in ('carregar', 'completo'):
        carregar_banco()
    if args.modo in ('simular', 'completo'):
        simular_ao_vivo()