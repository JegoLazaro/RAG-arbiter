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
JSON_FILE = "jujutsu_kaisen_chapters.json"

if not GEMINI_API_KEY or not PINECONE_API_KEY:
    raise ValueError("Missing API Keys! Check your .env file.")

# ==========================================
# 2. DEFINE FUNCTIONS
# ==========================================

def get_embedding(text, retry_count=0):
    client = genai.Client(api_key=GEMINI_API_KEY)
    try:
        response = client.models.embed_content(
            model="gemini-embedding-001",
            contents=text,
        )
        return [float(x) for x in response.embeddings.values]
    except Exception as e:
        if "429" in str(e) and retry_count < 5:
            wait_time = (retry_count + 1) * 12  
            print(f"   ⚠️ Rate limit hit. Sleeping {wait_time}s...")
            time.sleep(wait_time)
            return get_embedding(text, retry_count + 1)
        else:
            print(f"   ❌ Critical Error: {e}")
            raise e

def get_chapter_summary(chapter_url):
    """Scrapes only the 'Summary' section of a chapter page."""
    headers = {'User-Agent': 'AnimeArbiterBot/1.0'}
    try:
        response = requests.get(chapter_url, headers=headers)
        if response.status_code != 200: return ""
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Fandom wikis usually use a span with id="Summary" inside an h2
        summary_header = soup.find(id='Summary')
        
        content_parts = []
        if summary_header:
            # Get the parent h2, then find all following sibling tags
            parent_h2 = summary_header.find_parent('h2')
            if parent_h2:
                for sibling in parent_h2.find_next_siblings():
                    # Stop gathering when we hit the next h2 section (e.g., "Characters in Order of Appearance")
                    if sibling.name == 'h2': 
                        break
                    if sibling.name == 'p': 
                        text = sibling.get_text().strip()
                        if text:
                            content_parts.append(text)
                            
        return "\n\n".join(content_parts)
    except Exception as e:
        print(f"   Error parsing {chapter_url}: {e}")
        return ""

# ==========================================
# 3. INITIALIZE CONNECTIONS
# ==========================================
print("Connecting to Pinecone...")
pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(PINECONE_INDEX_NAME)

# ==========================================
# 4. MAIN INGESTION LOOP
# ==========================================
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=600, 
    chunk_overlap=100,
    separators=["\n\n", "\n", ".", " "]
)

def run_chapter_ingestion():
    if not os.path.exists(JSON_FILE):
        print(f"❌ {JSON_FILE} not found. Run discover_chapters.py first.")
        return

    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        chapters = json.load(f)

    print(f"🚀 Starting PLOT Ingestion for {len(chapters)} chapters...")

    for chap in chapters:
        name = chap['name']
        url = chap['url']

        print(f"📥 Processing {name}...")
        raw_text = get_chapter_summary(url)
        
        if not raw_text or len(raw_text.strip()) < 50:
            print(f"⚠️ No summary text found for {name}. Skipping.")
            continue
            
        chunks = text_splitter.split_text(raw_text)

        vectors_to_upload = []
        for i, chunk in enumerate(chunks):
            try:
                vector_math = get_embedding(chunk)
                
                # We use the chapter name itself as the citation source
                self_citation = {f"[Chapter]": name}
                
                vectors_to_upload.append({
                    "id": f"PLOT_{name.replace(' ', '_')}_v2_{i}",
                    "values": vector_math,
                    "metadata": {
                        "universe": UNIVERSE_NAME, 
                        "character": "Plot Event", # Distinguishes from character bios
                        "text": chunk,
                        "citations": json.dumps(self_citation),
                        "attributes": json.dumps({"type": "chapter_summary"}) 
                    }
                })
                time.sleep(0.2)
            except Exception as e:
                print(f"   ❌ Error on chunk {i}: {e}")

        if vectors_to_upload:
            index.upsert(vectors=vectors_to_upload)
            print(f"   ✅ Uploaded {name} plot events.")
        
        time.sleep(1)

if __name__ == "__main__":
    run_chapter_ingestion()