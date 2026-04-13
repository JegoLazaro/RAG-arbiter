import requests
from bs4 import BeautifulSoup
import json
import os

WIKI_URL = "https://jujutsu-kaisen.fandom.com/wiki/Volumes_%26_Chapters"
BASE_URL = "https://jujutsu-kaisen.fandom.com"
OUTPUT_FILE = "jujutsu_kaisen_chapters.json"

def discover_chapters():
    print(f"🔍 Accessing {WIKI_URL}...")
    headers = {'User-Agent': 'AnimeArbiterBot/1.0'}
    
    try:
        response = requests.get(WIKI_URL, headers=headers)
        if response.status_code != 200:
            print(f"❌ Failed to fetch page. Status: {response.status_code}")
            return

        soup = BeautifulSoup(response.text, 'html.parser')
        chapters = []
        
        # Find all links on the page
        links = soup.find_all('a', href=True)
        
        for link in links:
            href = link['href']
            title = link.get('title', '')
            
            # Filter: We only want Chapter pages (e.g., /wiki/Chapter_1)
            # Exclude Volumes, categories, and talk pages
            if "/wiki/" in href and ("Chapter" in title or "Chapter" in href):
                if not any(x in href for x in [":", "Volume", "List_of"]):
                    chapter_data = {
                        "name": title if title else href.split('/')[-1].replace('_', ' '),
                        "url": BASE_URL + href
                    }
                    if chapter_data not in chapters:
                        chapters.append(chapter_data)

        print(f"✅ Found {len(chapters)} unique chapters.")
        
        with open(OUTPUT_FILE, "w", encoding='utf-8') as f:
            json.dump(chapters, f, indent=4)
        print(f"💾 Saved to {OUTPUT_FILE}")

    except Exception as e:
        print(f"❌ Error during discovery: {e}")

if __name__ == "__main__":
    discover_chapters()