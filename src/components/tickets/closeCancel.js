export default {
  customId: 'close_cancel',

  async execute(client, interaction) {
    await interaction.update({ components: [] });
    await interaction.followUp({ content: '❎ Closure cancelled.', ephemeral: true });
  },
};
