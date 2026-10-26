from flask import request, jsonify
from backend.backend_api.simulation_manager import sim_manager
import pandas as pd
import joblib

# 1. Importa a factory e os modelos do seu próprio projeto
from backend.backend_api.app import create_app 
from backend.database.models import db, Telemetria, Veiculo, Alerta

# 2. Inicializa o App com a configuração correta do banco (PostgreSQL)
app = create_app()

print("Carregando modelo e scaler...")
modelo = joblib.load('backend/backend_api/ml_pipeline/fleetguard_model.joblib')
scaler = joblib.load('backend/backend_api/ml_pipeline/fleetguard_scaler.joblib')
frota_buffer = {}

frota_prob = {}
frota_classe_anterior = {}   # {veiculo_id: classe_prevista} — usado para detectar transições


def _classificar_tipo_falha(dados):
    """
    Deriva o tipo de falha a partir dos sensores da própria leitura,
    usando os mesmos limiares do /api/veiculos.
    """
    temp  = dados.get('temp_motor_spn110') or 0
    vib   = dados.get('vibracao_freio') or 0
    cubo  = dados.get('temp_cubo_roda_ir') or 0

    if cubo > 55:
        return 'freio'
    if vib > 0.30:
        return 'rolamento'
    if temp > 100:
        return 'motor'
    return 'desconhecido'


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

    proba = modelo.predict_proba(X_scaled)[0]
    classes = list(modelo.classes_)
    idx_falha = classes.index("Alerta: Falha Iminente")
    prob_falha = float(proba[idx_falha])
    frota_prob[vid] = prob_falha
    
    # --- C. Persistência no Banco de Dados ---
    veiculo = db.session.get(Veiculo, vid)
    if not veiculo:
        veiculo = Veiculo(id=vid)
        db.session.add(veiculo)
        db.session.commit()

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
        target=predicao
    )
    db.session.add(nova_telemetria)

    # --- D. Registro histórico de alerta (apenas na transição) ---
    classe_ant = frota_classe_anterior.get(vid)
    em_alerta     = "Alerta" in (predicao or "")
    em_alerta_ant = classe_ant is not None and "Alerta" in (classe_ant or "")

    if em_alerta and not em_alerta_ant:
        db.session.add(Alerta(
            veiculo_id=vid,
            timestamp=dados.get('timestamp'),
            classe_prevista=predicao,
            probabilidade=prob_falha,
            tipo_falha=_classificar_tipo_falha(dados),
        ))
    frota_classe_anterior[vid] = predicao

    db.session.commit()

    return jsonify({
        "veiculo_id": vid,
        "alerta_preditivo": predicao,
        "prob_falha": prob_falha,
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
        "velocidade_kmh_spn84": ultima_leitura.velocidade_kmh_spn84,
        "alerta_preditivo": ultima_leitura.target,
        "timestamp": ultima_leitura.timestamp,
        "prob_falha": frota_prob.get(veiculo_id),
    })


# ─── Histórico de alertas por veículo ──────────────────────────
@app.route('/api/veiculos/<int:veiculo_id>/alertas', methods=['GET'])
def listar_alertas_veiculo(veiculo_id):
    try:
        limit = int(request.args.get('limit', 20))
    except (TypeError, ValueError):
        limit = 20
    limit = max(1, min(limit, 200))

    alertas = (Alerta.query
               .filter_by(veiculo_id=veiculo_id)
               .order_by(Alerta.id.desc())
               .limit(limit)
               .all())

    return jsonify([{
        "id": a.id,
        "timestamp": a.timestamp,
        "classe_prevista": a.classe_prevista,
        "probabilidade": a.probabilidade,
        "tipo_falha": a.tipo_falha,
        # Sinaliza que é UTC para o browser interpretar corretamente
        "criado_em": a.criado_em.isoformat() + 'Z' if a.criado_em else None,
    } for a in alertas])


@app.route('/api/veiculos/resumo', methods=['GET'])
def resumo_frota():
    from sqlalchemy import func

    total = db.session.query(func.count(Veiculo.id)).scalar() or 0

    sub = (
        db.session.query(
            Telemetria.veiculo_id,
            func.max(Telemetria.id).label('ultimo_id')
        )
        .group_by(Telemetria.veiculo_id)
        .subquery()
    )

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
    
    
# ─── Lista de veículos disponíveis ─────────────────────────────
@app.route('/api/veiculos', methods=['GET'])
def listar_veiculos():
    from backend.backend_api.simulation_manager import _load_dataset
    df = _load_dataset()

    info_falha = {}
    if 'target' in df.columns:
        for vid, g in df.groupby('veiculo_id'):
            em_alerta = g[g['target'] != "Operação Normal"]
            if em_alerta.empty:
                info_falha[int(vid)] = 'normal'
                continue

            ult = em_alerta.tail(150)
            temp_alta = ult['temp_motor_spn110'].mean() > 100
            vib_alta  = ult['vibracao_freio'].mean() > 0.30
            cubo_alto = ult['temp_cubo_roda_ir'].mean() > 55

            if temp_alta and not vib_alta and not cubo_alto:
                info_falha[int(vid)] = 'motor'
            elif vib_alta and not cubo_alto:
                info_falha[int(vid)] = 'rolamento'
            elif cubo_alto:
                info_falha[int(vid)] = 'freio'
            else:
                info_falha[int(vid)] = 'motor'

    veiculos = Veiculo.query.order_by(Veiculo.id).all()
    resultado = []
    for v in veiculos:
        ultima = (Telemetria.query
                  .filter_by(veiculo_id=v.id)
                  .order_by(Telemetria.id.desc())
                  .first())
        resultado.append({
            "id": v.id,
            "ativo": v.ativo,
            "ultimo_alerta": ultima.target if ultima else None,
            "tipo_falha": info_falha.get(v.id, 'normal'),
        })
    return jsonify(resultado)


# ─── Controle da simulação ─────────────────────────────────────
@app.route('/api/simulacao/iniciar', methods=['POST'])
def iniciar_simulacao():
    dados = request.json or {}
    veiculo_id = dados.get('veiculo_id')
    intervalo  = dados.get('intervalo_s', 1.0)
    inicio_pct = dados.get('inicio_pct')

    if veiculo_id is None:
        return jsonify({"erro": "veiculo_id obrigatório"}), 400

    # [HISTÓRICO] Reseta o rastreador de transição desse veículo
    # para que um novo replay gere um novo registro de alerta no banco.
    frota_classe_anterior.pop(int(veiculo_id), None)

    ok, erro = sim_manager.start(
        veiculo_id=int(veiculo_id),
        intervalo_s=float(intervalo),
        inicio_pct=inicio_pct,
    )
    if not ok:
        return jsonify({"erro": erro}), 400
    return jsonify({"status": "iniciado", "veiculo_id": veiculo_id})


@app.route('/api/simulacao/parar', methods=['POST'])
def parar_simulacao():
    sim_manager.stop()
    return jsonify({"status": "parado"})


@app.route('/api/simulacao/status', methods=['GET'])
def status_simulacao():
    return jsonify(sim_manager.status())
    
if __name__ == '__main__':
    app.run(debug=True, port=5000)