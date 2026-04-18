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
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")
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
        # rate limit handler with exponential backoff
        if "429" in str(e) and retry_count < 5:
            wait_time = (retry_count + 1) * 12  
            print(f"   ⚠️ Rate limit hit. Sleeping {wait_time}s before retrying...")
            time.sleep(wait_time)
            return get_embedding(text, retry_count + 1)
        else:
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
        if response.status_code != 200: return "", {} # FIXED: Ensure two values are returned
        data = response.json()
        
        if 'parse' in data and 'text' in data['parse']:
            raw_html = data['parse']['text']['*']
            soup = BeautifulSoup(raw_html, 'html.parser')
            
            # --- 1. EXTRACT REFERENCE LIST ---
            citation_map = {}
            ref_section = soup.find('ol', class_='references')
            if ref_section:
                for i, li in enumerate(ref_section.find_all('li'), 1):
                    clean_ref = li.get_text().strip().replace('↑', '').strip()
                    citation_map[f"[{i}]"] = clean_ref

            # --- 2. CLEAN MAIN CONTENT ---
            for unwanted in soup.find_all(['aside', 'table', 'nav', 'script', 'style', 'div.ad-slot']):
                unwanted.decompose()

            paragraphs = soup.find_all('p')
            
            full_text_parts = []
            for p in paragraphs:
                p_text = p.get_text().strip()
                if p_text:
                    full_text_parts.append(p_text)

            combined_text = "\n\n".join(full_text_parts)
            return combined_text, citation_map
            
        return "", {}
    except Exception as e:
        print(f"   Error parsing HTML for {character_name}: {e}")
        return "", {} # FIXED: Ensure two values are returned

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
# UPDATED: Increased chunk size to handle the added length of citations
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=600, 
    chunk_overlap=100,
    separators=["\n\n", "\n", ".", " "]
)

def run_ingestion():
    processed_urls = set()
    if os.path.exists("processed_urls.txt"):
        with open("processed_urls.txt", "r") as f:
            processed_urls = set(line.strip() for line in f)

    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        characters = json.load(f)

    print(f"🚀 Starting Ingestion for {len(characters)} characters...")

    for char in characters:
        name = char['name']
        url = char['url']

        if url in processed_urls:
            print(f"⏭️ Skipping {name}")
            continue

        print(f"📥 Processing {name} with Citations...")
        raw_text, citation_map = get_character_text_hybrid(name)
        
        if not raw_text or len(raw_text.strip()) < 50:
            print(f"⚠️ No text for {name}.")
            continue
            
        chunks = text_splitter.split_text(raw_text)

        vectors_to_upload = []
        for i, chunk in enumerate(chunks):
            try:
                relevant_citations = {k: v for k, v in citation_map.items() if k in chunk}
                
                vector_math = get_embedding(chunk)
                
                # UPDATED: Added extensible attributes dictionary
                vectors_to_upload.append({
                    "id": f"{name.replace(' ', '_')}_v2_{i}",
                    "values": vector_math,
                    "metadata": {
                        "universe": UNIVERSE_NAME, 
                        "character": name, 
                        "text": chunk,
                        "citations": json.dumps(relevant_citations),
                        "attributes": json.dumps({}) 
                    }
                })
                time.sleep(0.2)
            except Exception as e:
                print(f"   ❌ Error on chunk {i}: {e}")

        if vectors_to_upload:
            index.upsert(vectors=vectors_to_upload
                        #  , namespace=UNIVERSE_NAME
                         )
            print(f"   ✅ Uploaded {name} with {len(citation_map)} references mapped.")
            with open("processed_urls.txt", "a") as f:
                f.write(url + "\n")
        
        time.sleep(1)

if __name__ == "__main__":
    run_ingestion()