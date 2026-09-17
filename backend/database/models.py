from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

# Inicializamos o db AQUI, não no __init__.py, para evitar importação circular
db = SQLAlchemy()

class Veiculo(db.Model):
    __tablename__ = 'veiculos'
    
    id = db.Column(db.Integer, primary_key=True) # Corresponde ao veiculo_id do mock
    ativo = db.Column(db.Boolean, default=True)
    data_cadastro = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relacionamento: 1 veículo tem várias linhas de telemetria
    telemetrias = db.relationship('Telemetria', backref='veiculo', lazy=True)

class Telemetria(db.Model):
    __tablename__ = 'telemetria'
    
    id = db.Column(db.Integer, primary_key=True)
    veiculo_id = db.Column(db.Integer, db.ForeignKey('veiculos.id'), nullable=False)
    timestamp = db.Column(db.Float, nullable=False)
    
    velocidade_kmh_spn84 = db.Column(db.Float)
    rpm_spn190 = db.Column(db.Float)
    carga_motor_spn92 = db.Column(db.Float)
    temp_motor_spn110 = db.Column(db.Float)
    pressao_oleo_spn100 = db.Column(db.Float)
    vibracao_freio = db.Column(db.Float)
    temp_cubo_roda_ir = db.Column(db.Float)
    
    status_porta = db.Column(db.String(20))
    tensao_bateria_v = db.Column(db.Float)
    codigo_erro_scanner = db.Column(db.String(50))
    target = db.Column(db.String(50))