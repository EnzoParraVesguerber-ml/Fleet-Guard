from flask import request, jsonify
import pandas as pd
import joblib

# 1. Importa a factory e os modelos do seu próprio projeto
# (Ajuste "backend_api.app" se o seu __init__.py estiver em outro diretório)
from backend.backend_api.app import create_app 
from backend.database.models import db, Telemetria, Veiculo

# 2. Inicializa o App com a configuração correta do banco (PostgreSQL)
app = create_app()

print("Carregando modelo e scaler...")
modelo = joblib.load('backend/backend_api/ml_pipeline/fleetguard_model.joblib')
scaler = joblib.load('backend/backend_api/ml_pipeline/fleetguard_scaler.joblib')
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
    # Ordem EXATA usada no treino (train_model.py depois do drop):
    FEATURES_ORDEM = [
        'velocidade_kmh_spn84',
        'rpm_spn190',
        'carga_motor_spn92',
        'temp_motor_spn110',
        'pressao_oleo_spn100',
        'vibracao_freio',
        'temp_cubo_roda_ir',
        'temp_motor_spn110_media_30',
        'temp_motor_spn110_std_30',
        'vibracao_freio_media_30',
        'vibracao_freio_std_30',
        'temp_cubo_roda_ir_media_30',
        'temp_cubo_roda_ir_std_30',
    ]

    linha_atual = df_buffer.iloc[[-1]].copy()
    X_inferencia = linha_atual.reindex(columns=FEATURES_ORDEM).fillna(0.0)

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


    
@app.route('/api/telemetria/atual/<int:veiculo_id>', methods=['GET'])
def obter_telemetria_atual(veiculo_id):
    ultima_leitura = Telemetria.query.filter_by(veiculo_id=veiculo_id).order_by(Telemetria.id.desc()).first()
    
    if not ultima_leitura:
        return jsonify({"erro": "Nenhum dado encontrado"}), 404
        
    return jsonify({
        "temp_motor": ultima_leitura.temp_motor_spn110,
        "rpm": ultima_leitura.rpm_spn190,
        "pressao_oleo": ultima_leitura.pressao_oleo_spn100,
        "vibracao": ultima_leitura.vibracao_freio,
        "velocidade_kmh_spn84": ultima_leitura.velocidade_kmh_spn84,   # ← NOVA LINHA
        "alerta_preditivo": ultima_leitura.target
    })
    
@app.route('/api/veiculos/resumo', methods=['GET'])
def resumo_frota():
    """
    Retorna quantos veículos existem, quantos estão 'ok' e quantos em alerta,
    com base na ÚLTIMA leitura de telemetria de cada veículo.
    """
    from sqlalchemy import func

    total = db.session.query(func.count(Veiculo.id)).scalar() or 0

    # Subquery: id da última telemetria de cada veículo
    sub = (
        db.session.query(
            Telemetria.veiculo_id,
            func.max(Telemetria.id).label('ultimo_id')
        )
        .group_by(Telemetria.veiculo_id)
        .subquery()
    )

    # Junta com Telemetria para pegar o 'target' da última leitura
    ultimas = (
        db.session.query(Telemetria)
        .join(sub, Telemetria.id == sub.c.ultimo_id)
        .all()
    )

    em_alerta = sum(1 for t in ultimas if t.target and "Alerta" in t.target)
    normais   = len(ultimas) - em_alerta

    return jsonify({
        "total": total,
        "operando_normal": normais,
        "em_alerta": em_alerta,
        "com_dados": len(ultimas)
    })
    
    
if __name__ == '__main__':
    app.run(debug=True, port=5000)