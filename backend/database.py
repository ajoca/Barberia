from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB setup
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "barbershop")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Database dependency
async def get_database():
    return db

# Close connection function
def close_db_connection():
    client.close()