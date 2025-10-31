import os
import re
import difflib
from flask import Flask, request, jsonify
from flask_cors import CORS
import traceback

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# --- Load spaCy model ---
print("🔄 Loading spaCy model (en_core_web_md)...")
try:
    import spacy
    nlp = spacy.load("en_core_web_md")
    print("✅ spaCy model loaded successfully.")
except Exception as e:
    print("⚠️ spaCy model load failed:", e)
    print("Using fallback text similarity (difflib).")
    nlp = None

# --- Directory paths ---
WORDS_FOLDER = "frontend/public/static/words"
ALPHABET_FOLDER = "frontend/public/static/alphabet"

# --- Ensure folders exist ---
os.makedirs(WORDS_FOLDER, exist_ok=True)
os.makedirs(ALPHABET_FOLDER, exist_ok=True)

# --- Data structures ---
sign_map = {}           # "spoken text" -> {"path": "...", "vector": nlp vector}
sorted_phrases = []     # list of spoken keys sorted longest → shortest

# --- Load sign files ---
print(f"📂 Scanning folder: {WORDS_FOLDER}")

for filename in os.listdir(WORDS_FOLDER):
    if filename.lower().endswith((".mp4", ".gif")):
        spoken_form = re.sub(r'[-_]', ' ', os.path.splitext(filename)[0]).strip().lower()
        file_path = f"static/words/{filename}"

        # Compute spaCy vector or fallback
        vector = nlp(spoken_form).vector if nlp else None
        sign_map[spoken_form] = {"path": file_path, "vector": vector}

        print(f"✅ Loaded: '{spoken_form}' -> {file_path}")

# Sort keys by length (longest first)
sorted_phrases = sorted(sign_map.keys(), key=lambda x: len(x), reverse=True)
print(f"📊 Total signs loaded: {len(sorted_phrases)}")

# --- Helper: fuzzy match using spaCy or difflib ---
def fuzzy_match(word):
    if not word.strip():
        return None, 0.0

    best_match = None
    best_score = 0.0
    word_doc = nlp(word) if nlp else None

    for candidate, data in sign_map.items():
        score = (
            word_doc.similarity(nlp(candidate))
            if nlp and word_doc.vector_norm and nlp(candidate).vector_norm
            else difflib.SequenceMatcher(None, word, candidate).ratio()
        )

        if score > best_score:
            best_match, best_score = candidate, score

    return best_match, best_score

# --- /translate endpoint ---
@app.route("/translate", methods=["POST"])
def translate():
    try:
        data = request.get_json()
        if not data or "text" not in data:
            return jsonify({"error": "Missing 'text' field"}), 400

        text = re.sub(r'[^a-zA-Z\s]', '', data["text"]).lower().strip()
        words = text.split()
        results = []
        print(f"\n🗣️ Received text: '{text}'")

        while words:
            phrase = " ".join(words)
            matched = False

            # Exact Greedy Match
            for key in sorted_phrases:
                if phrase.startswith(key):
                    results.append({
                        "original_word": key,
                        "matched_word": key,
                        "path": sign_map[key]["path"],
                        "match_type": "exact"
                    })
                    print(f"🎯 Exact match: '{key}' -> {sign_map[key]['path']}")
                    # Remove matched phrase words
                    key_word_count = len(key.split())
                    words = words[key_word_count:]
                    matched = True
                    break

            if matched:
                continue

            # Fuzzy Match (take first word)
            if words:
                first_word = words[0]
                best_match, score = fuzzy_match(first_word)

                if best_match and score >= 0.6:
                    results.append({
                        "original_word": first_word,
                        "matched_word": best_match,
                        "path": sign_map[best_match]["path"],
                        "match_type": "fuzzy"
                    })
                    print(f"🤖 Fuzzy match: '{first_word}' ≈ '{best_match}' ({score:.2f}) -> {sign_map[best_match]['path']}")
                else:
                    # Letter-by-letter fallback for unknown word
                    print(f"🔤 Unknown word: '{first_word}' — breaking into letters")
                    for letter in first_word:
                        letter_file = f"{ALPHABET_FOLDER}/{letter.lower()}.mp4"
                        if os.path.exists(letter_file):
                            results.append({
                                "original_word": first_word,
                                "matched_word": letter,
                                "path": f"static/alphabet/{letter.lower()}.mp4",
                                "match_type": "alphabet"
                            })
                        else:
                            print(f"⚠️ Missing alphabet file: {letter_file}")

                words.pop(0)

        return jsonify({"results": results}), 200

    except Exception as e:
        print("🔥 Error in /translate:", traceback.format_exc())
        return jsonify({"error": "Server error", "details": str(e)}), 500


# --- Run server ---
if __name__ == "__main__":
    print("🚀 Starting Speech-to-Sign Flask server on http://127.0.0.1:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
