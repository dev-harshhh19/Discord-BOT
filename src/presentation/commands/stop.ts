import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { BotCommand, PermissionLevel, ServerState, ServiceContainer } from '../../types';
import { buildStopConfirmEmbed, buildErrorEmbed } from '../components/embeds';
import { buildStopConfirmButtons } from '../components/buttons';
import { commandDescription } from './shared';

/**
 * Presents the stop confirmation prompt.
 *
 * The confirmation buttons are handled by the central button registry in
 * `events/buttonHandlers.ts`. This command previously also attached its own
 * `createMessageComponentCollector`, so a single click was processed twice:
 * `stopServer()` ran twice and the second reply failed with "interaction has
 * already been acknowledged".
 */
export const stopCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription(commandDescription('Stop the {server} server (requires confirmation)')),

  requiredPermission: PermissionLevel.TRUSTED,

  async execute(
    interaction: ChatInputCommandInteraction,
    services: ServiceContainer,
  ): Promise<void> {
    if (
      services.currentState !== ServerState.ONLINE &&
      services.currentState !== ServerState.STARTING &&
      services.currentState !== ServerState.QUEUEING
    ) {
      await interaction.reply({
        embeds: [
          buildErrorEmbed(
            `The server is not online or starting (current state: ${services.currentState.toLowerCase()}).`,
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      embeds: [buildStopConfirmEmbed()],
      components: [buildStopConfirmButtons()],
      flags: MessageFlags.Ephemeral,
    });
  },
};
