import json
import time
import os
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# The AI & Database Libraries
from pinecone import Pinecone
from google import genai 
from langchain_text_splitters import RecursiveCharacterTextSplitter 

# ==========================================
# 1. SETUP & ENVIRONMENT
# ==========================================
load_dotenv() 

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = "anime-arbiter" 
UNIVERSE_NAME = "Jujutsu Kaisen"
JSON_FILE = "jujutsu_kaisen_links.json"
WIKI_DOMAIN = "jujutsu-kaisen.fandom.com"

if not GEMINI_API_KEY or not PINECONE_API_KEY:
    raise ValueError("Missing API Keys! Check your .env file.")

# ==========================================
# 2. DEFINE FUNCTIONS FIRST
# ==========================================

def get_embedding(text, retry_count=0):
    """Safely extracts the embedding vector from the Google GenAI SDK response."""
    client = genai.Client(api_key=GEMINI_API_KEY)
    try:
        response = client.models.embed_content(
        model="gemini-embedding-001",
        contents=text,
        )
        
        # 1. Access the first ContentEmbedding object in the list
        item = response.embeddings 
        
        print(f"   🧠 Received embedding with {len(item)} dimensions.")
        print(f"   Sample values: {item[:5]}")  # Print the first 5 values for verification
        
        # 2. Extract the actual list of numbers from the .values attribute
        raw_values = item[0].values  # Access the .values attribute of the first ContentEmbedding object

        # 3. Pinecone Requirement: Ensure every number is a standard float
        return [float(x) for x in raw_values]
    except Exception as e:
        # Check if the error is a Rate Limit (429)
        if "429" in str(e) and retry_count < 5:
            wait_time = (retry_count + 1) * 12  # Exponential wait: 12s, 24s, 36s...
            print(f"   ⚠️ Rate limit hit. Sleeping {wait_time}s before retrying...")
            time.sleep(wait_time)
            return get_embedding(text, retry_count + 1)
        else:
            # If it's a different error or we've retried too much, stop
            print(f"   ❌ Critical Error: {e}")
            raise e



def get_character_text_hybrid(character_name):
    """Uses the API to get HTML (bypassing Cloudflare), then parses text cleanly."""
    api_url = f"https://{WIKI_DOMAIN}/api.php"
    params = {
        "action": "parse",
        "page": character_name,
        "format": "json",
        "prop": "text",
        "redirects": 1 
    }
    headers = {'User-Agent': 'AnimeArbiterBot/1.0'}
    
    try:
        response = requests.get(api_url, headers=headers, params=params)
        if response.status_code != 200: return ""
        data = response.json()
        if 'parse' in data and 'text' in data['parse']:
            raw_html = data['parse']['text']['*']
            soup = BeautifulSoup(raw_html, 'html.parser')
            for unwanted in soup.find_all(['aside', 'table', 'nav', 'script', 'style']):
                unwanted.decompose()
            paragraphs = soup.find_all('p')
            return " ".join([p.text.strip() for p in paragraphs if p.text.strip()])
        return ""
    except Exception as e:
        print(f"   Error parsing HTML for {character_name}: {e}")
        return ""

# ==========================================
# 3. INITIALIZE CONNECTIONS & RUN CHECKER
# ==========================================
print("Setting up AI and Database connections...")
pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(PINECONE_INDEX_NAME)

print(f"Checking connection to Pinecone index: {PINECONE_INDEX_NAME}...")
try:
    stats = index.describe_index_stats()
    print("✅ Successfully connected to Pinecone!")
    print(f"📊 Index Stats: {stats['total_vector_count']} vectors currently stored.")
    
    print("🧪 Testing Gemini embedding pipeline...")
    test_vec = get_embedding("Test connection")
    if len(test_vec) == 3072:
        print(f"✅ Gemini is outputting correct dimensions (3072).")
    else:
        print(f"⚠️ Dimension Mismatch! Expected 3072, got {len(test_vec)}.")
except Exception as e:
    print(f"❌ Connection Failed: {e}")
    exit()

# ==========================================
# 4. MAIN INGESTION LOOP
# ==========================================
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
    separators=["\n\n", "\n", ".", " "]
)

def run_ingestion():
    processed_urls = set()
    if os.path.exists("processed_urls.txt"):
        with open("processed_urls.txt", "r") as f:
            processed_urls = set(line.strip() for line in f)

    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        characters = json.load(f)

    print(f"Found {len(characters)} characters. Starting ingestion...")

    for char in characters:
        name = char['name']
        url = char['url']

        if url in processed_urls:
            print(f"⏭️ Skipping {name} (Already processed)")
            continue

        print(f"📥 Processing {name}...")
        raw_text = get_character_text_hybrid(name)
        
        if not raw_text or len(raw_text.strip()) < 50:
            print(f"⚠️ No usable text found for {name}. Skipping.")
            continue
            
        chunks = text_splitter.split_text(raw_text)
        print(f"   Chopped into {len(chunks)} chunks. Embedding...")

        vectors_to_upload = []
        for i, chunk in enumerate(chunks):
            try:
                time.sleep(0.5) 
                vector_math = get_embedding(chunk)
                vectors_to_upload.append({
                    "id": f"{name.replace(' ', '_')}_chunk_{i}",
                    "values": vector_math,
                    "metadata": {"universe": UNIVERSE_NAME, "character": name, "text": chunk}
                })
            except Exception as e:
                print(f"   ❌ Failed to embed chunk {i}: {e}")

        if vectors_to_upload:
            index.upsert(vectors=vectors_to_upload)
            print(f"   ✅ Successfully uploaded {name} to Pinecone!")
            with open("processed_urls.txt", "a") as f:
                f.write(url + "\n")
        time.sleep(2)

run_ingestion()