import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';

export class BotClient extends Client {
  commands = new Collection();
  components = new Collection();

  ticketService = null;
  loggingService = null;

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
      ],
      partials: [
        Partials.Message, 
        Partials.Channel, 
        Partials.GuildMember
      ],
      sweepers: {
        messages: { 
          interval: 300, 
          lifetime: 600 
        },
      },
    });
  }
}
