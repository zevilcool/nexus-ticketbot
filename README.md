```
 _____ ___ ____ _  _______ _____ ____   ___ _____ 
|_   _|_ _/ ___| |/ / ____|_   _| __ ) / _ \_   _|
  | |  | | |   | \' /|  _|   | | |  _ \| | | || |  
  | |  | | |___| . \| |___  | | | |_) | |_| || |  
  |_| |___\____|_|\_\_____| |_| |____/ \___/ |_|  
```

# Nexus Ticketbot - a Discord ticket system

this is a discord bot for managing support tickets and logging server activity. it's built with node.js, discord.js v14, and prisma orm. works with sqlite or postgres.

## 👀 Features

### 🎫 Ticket system
  - no more old commands. uses discord's buttons, select menus, and modals
  - custom categories: set up different types of tickets (general, bugs, billing, etc)
  - auto close: tickets get closed if nobody talks for a while
  - staff tools: assign tickets, set priority, add private notes
  - secure: only ticket creator and staff can see tickets
  - transcripts: saves chat logs as html files when tickets close

### 📊 Server logging
  - keeps track of important stuff happening on your server
  - message logs: sees message edits and deletes.
  - member logs: tracks joins, leaves, kicks, bans, profile changes
  - voice/channel logs: monitors voice channel activity and channel changes
  - fast: handles lots of events without slowing down
  - cleanup: deletes old logs based on your settings

## 🤔 How to get it running

### 👨🏻‍💻 Stuff you need:
- Node.js (Version 20 or newer)
- A Discord Bot Token (get it from the [Discord Developer portal](https://discord.com/developers/applications))
- A Database (SQLite is default, postgres works too if u need it for massive communities)

### 1. Clone the repos and install
```bash
git clone https://github.com/zevilcool/nexus-ticketbot.git
cd ticketbot
npm install
```

### 2. Configure it
Copy the example config file and put your Bot's info in it
```bash
cp .env.example .env
```
Edit `.env` with your `DISCORD_TOKEN` and `CLIENT_ID`

### 3. Database setup
```bash
npm run db:migrate
npm run db:generate
```

### 4. Deploy commands
This registers the slash commands with discord.
```bash
npm run deploy
```

### 5. Start the bot
```bash
npm start
```

## Project structure (for devs)
```
src/
├── index.js              # entry point
├── client.js             # custom Discord client
├── modules/
│   ├── tickets/          # ticket system
│   └── logging/          # logging system
├── commands/             # slash commands
├── events/               # Discord events
└── utils/                # helpers
```

## ⁉️ Why This Bot?

it uses modern Discord interactions (no outdated command systems like other discord bot does)

clean and modular codebase (easy to extend)
works for both small communities and larger servers

focus on performance and stability

## 📝 Small Notes:

SQLite is fine for small servers, but Postgres is better if you expect higher load

if something breaks, double-check your .env first (it’s usually that)

feel free to tweak things! the structure is meant to be easy to extend

if it shows this kind of error: [deploy] Failed to register commands {"error":"Missing Access"}
3 possible thing could happens: 
1. your bot token are bad
2. your client id doesn't match with the token
3. the bot arent inside the guild (if u fill the GUILD_ID)

## License

MIT llicense. see `license` file for more details!
