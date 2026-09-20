from flask import Flask
from flask_cors import CORS

from backend.backend_api.app.config import Config
from backend.database.models import db


def create_app():
    """Factory do aplicativo Flask do FleetGuard."""
    app = Flask(__name__)

    # Aceita tanto localhost quanto 127.0.0.1 na porta 4200 (Angular)
    CORS(app, resources={r"/api/*": {"origins": [
        "http://localhost:4200",
        "http://127.0.0.1:4200",
    ]}})

    app.config.from_object(Config)
    db.init_app(app)

    with app.app_context():
        db.create_all()

    return app