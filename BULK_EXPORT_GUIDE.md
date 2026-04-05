# Bulk Player Export Guide

## Overview

The bulk player export feature allows you to accumulate multiple players into a single JSON file that can be imported into the VBM app all at once. This is perfect for creating teams or rosters without having to add players one-by-one.

## Workflow

### Creating Your First Bulk Export

1. **Create a player** using the player builder as usual
2. Click **"Export to VBM"** to open the export panel
3. Click **"Start Bulk Export"** button in the mode selector
4. The current player is automatically added to the bulk export
5. You'll see the bulk export view with your first player listed

### Adding More Players

You have two options:

#### Option A: Generate New Players (Recommended for Fast Workflow)
1. Go back to the single player export view by clicking **"← Back to Single"**
2. Create a new player (randomize stats, adjust name, etc.)
3. Click **"Export to VBM"** again
4. Click **"Continue Bulk (X)"** to add this player to your existing bulk export
5. Repeat until you have all players needed

#### Option B: Load Existing Bulk File
1. Have your bulk JSON file ready from a previous session
2. Create or load a player
3. Click **"Export to VBM"**
4. In bulk export mode, click **"Load Existing Bulk"**
5. Select your JSON file - the current player will be added to it
6. Continue adding more players as needed

### Managing Your Bulk Export

In the bulk export view, you can:

- **View all players** in a table showing Name, Position, Overall, Age, and Country
- **Remove individual players** by clicking the ✕ button next to any player
- **Copy JSON to clipboard** to paste into APIs or other tools
- **Download the file** as `bulk_players.json` to save locally
- **Clear all** to start fresh

### Downloading and Importing

Once you're satisfied with your bulk export:

1. Click **"Download"** to save the file as `bulk_players.json`
2. In your VBM app, look for a bulk import feature or API endpoint
3. Upload/import the JSON file, or send it via API:

```bash
curl -X POST http://localhost:3000/api/players/bulk \
  -H "Content-Type: application/json" \
  -d @bulk_players.json
```

## Bulk JSON File Format

The exported bulk file has this structure:

```json
{
  "version": "1.0",
  "created_at": "2026-04-05T12:30:00.000Z",
  "players": [
    {
      "player_name": "John Smith",
      "position": "Opposite",
      "age": 25,
      "country": "United States",
      "jersey_number": 7,
      "height": 195,
      "potential": 85,
      "overall": 78,
      "attack": 82,
      "defense": 75,
      "serve": 80,
      ... (all stats)
      "contract_years": 2,
      "monthly_wage": 5000,
      "player_value": 500000
    },
    ... (more players)
  ]
}
```

## Tips

- **Create in batches**: Generate all players for a position, then move to the next
- **Backup your files**: Download your bulk exports regularly
- **Use meaningful names**: Make it easy to identify players in your file
- **Check the preview**: The table shows key stats before download
- **Reuse files**: You can load the same bulk file multiple times and keep adding players

## Troubleshooting

### File Won't Load
- Ensure the JSON file has the correct format (version, created_at, players array)
- Make sure the file isn't corrupted
- Try opening it in a text editor to verify

### Players Not Showing in List
- Scroll up in the export panel to see the table
- The JSON preview at the bottom shows all data if the table is hard to read

### Lost My Bulk File
- Always keep a copy of your downloads
- The bulk data is lost when you close the page, so download before leaving

## Integration with VBM

To add bulk import support to your VBM app, create an endpoint like:

```python
# Example: FastAPI endpoint
@app.post("/api/players/bulk")
async def bulk_add_players(bulk_data: dict):
    players = bulk_data.get("players", [])
    results = []
    for player in players:
        # Your player creation logic here
        results.append(create_player(player))
    return {"created": len(results), "players": results}
```

Then users can import the bulk file using their API or admin panel.
