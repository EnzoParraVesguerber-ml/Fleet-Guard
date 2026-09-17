import os
from dotenv import load_dotenv

# Carrega as variáveis do arquivo .env
load_dotenv()

class Config:
    # Busca a URL do banco. Se não encontrar o .env, ele vai levantar um erro 
    # claro em vez de tentar conectar no vazio.
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
    
    if not SQLALCHEMY_DATABASE_URI:
        raise ValueError("A variável DATABASE_URL não foi encontrada. Verifique seu arquivo .env!")

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Filtro operacional da frota: restrição de leitura de sensores
    OPERATIONAL_START_HOUR = 0
    OPERATIONAL_END_HOUR = 20