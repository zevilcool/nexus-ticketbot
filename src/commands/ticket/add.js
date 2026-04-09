import { SlashCommandBuilder } from 'discord.js';
import { ticketRepository } from '../../modules/tickets/ticket.repository.js';
import { errorEmbed } from '../../utils/embed.js';

export default {
  staffOnly: true,

  data: new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add a user or role to this ticket')
    .addUserOption((o) => o.setName('user').setDescription('User to add'))
    .addRoleOption((o) => o.setName('role').setDescription('Role to add')),

  async execute(client, interaction) {
    const ticket = await ticketRepository.findByChannelId(interaction.channelId);
    if (!ticket) {
      return interaction.reply({ embeds: [errorEmbed('Not a Ticket', 'Use this command inside a ticket channel.')], ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');

    if (!user && !role) {
      return interaction.reply({ embeds: [errorEmbed('Missing Target', 'Provide a user or a role.')], ephemeral: true });
    }

    await interaction.deferReply();

    const target = user ?? role;
    const result = await client.ticketService.addMember(interaction.channel, target.id, !!role, interaction.user.id);

    if (result.error) return interaction.editReply({ embeds: [errorEmbed('Error', result.error)] });

    await interaction.deleteReply();
  },
};
