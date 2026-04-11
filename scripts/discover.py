import requests
import json
import time

def discover_characters_api(wiki_domain, category_name, universe_name):
    """
    Uses the hidden MediaWiki API to fetch character lists without getting blocked by Cloudflare.
    """
    # The API endpoint for all Fandom wikis
    api_url = f"https://{wiki_domain}/api.php"
    all_links = []
    
    # These parameters tell the API exactly what we want
    params = {
        "action": "query",
        "list": "categorymembers",
        "cmtitle": f"Category:{category_name}",
        "cmlimit": "500", # Grab up to 500 characters at a time
        "format": "json"
    }
    
    # A polite User-Agent
    headers = {
        'User-Agent': 'AnimeArbiterBot/1.0 (Learning Project)'
    }

    print(f"🚀 Starting API discovery for {universe_name}...")
    
    while True:
        response = requests.get(api_url, headers=headers, params=params)
        
        if response.status_code != 200:
            print(f"Failed to retrieve API. Status Code: {response.status_code}")
            break
            
        data = response.json()
        
        # Dig into the JSON response to find the list of characters
        members = data.get('query', {}).get('categorymembers', [])
        
        for member in members:
            # ns: 0 means it's a standard article (not a user page or image file)
            if member['ns'] == 0:
                name = member['title']
                
                # Fandom URLs use underscores instead of spaces
                url_name = name.replace(" ", "_")
                full_url = f"https://{wiki_domain}/wiki/{url_name}"
                
                all_links.append({
                    "name": name,
                    "url": full_url
                })
        
        # If there are more than 500 characters, the API gives us a "continue" token
        if 'continue' in data:
            print("Found more characters. Fetching the next batch...")
            params['cmcontinue'] = data['continue']['cmcontinue']
            time.sleep(1) # Be polite to the server
        else:
            break # No more pages, exit the loop
            
    # Save the extracted links
    output_file = f"{universe_name.lower().replace(' ', '_')}_links.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_links, f, indent=4)
        
    print(f"✅ Success! Saved {len(all_links)} characters to {output_file}")

# --- EXECUTION ---
discover_characters_api("jujutsu-kaisen.fandom.com", "Characters", "Jujutsu Kaisen")
discover_characters_api("myheroacademia.fandom.com", "Characters", "My Hero Academia")
discover_characters_api("kimetsu-no-yaiba.fandom.com", "Characters", "Demon Slayer")
# discover_characters_api("onepiece.fandom.com", "Characters", "One Piece")
# discover_characters_api("dragonball.fandom.com", "Characters", "Dragon Ball")