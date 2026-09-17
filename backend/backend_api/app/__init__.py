from flask import Flask
import sys
import os

# Adiciona a raiz do projeto ao path para o Python achar a pasta 'database'
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from backend_api.app.config import Config
from database.models import db

def create_app():
    """Factory do aplicativo Flask do FleetGuard."""
    app = Flask(__name__)
    app.config.from_object(Config)
    
    db.init_app(app)
    
    # Cria as tabelas no PostgreSQL automaticamente ao rodar o app
    with app.app_context():
        db.create_all()
    
    return app