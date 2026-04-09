import { Events } from 'discord.js';

export default {
  name: Events.VoiceStateUpdate,

  async execute(client, oldState, newState) {
    const guildId = newState.guild?.id ?? oldState.guild?.id;
    if (!guildId) return;

    const embed = client.loggingService.buildVoiceEmbed(oldState, newState);
    if (!embed) return; // minor state change (mute/deafen) with no embed generated

    const joined    = !oldState.channelId &&  newState.channelId;
    const left      =  oldState.channelId && !newState.channelId;
    const eventType = joined ? 'VOICE_JOIN' : left ? 'VOICE_LEAVE' : 'VOICE_MOVE';

    client.loggingService.log({
      guildId,
      eventType,
      actorId:   newState.member?.id ?? oldState.member?.id,
      targetType: 'VOICE_CHANNEL',
      details:   { from: oldState.channelId ?? null, to: newState.channelId ?? null },
      embed,
    });
  },
};
