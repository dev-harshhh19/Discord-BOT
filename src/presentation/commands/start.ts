import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand, PermissionLevel, ServerState, ServiceContainer } from '../../types';
import { buildStartingEmbed, buildErrorEmbed, buildStatusEmbed } from '../components/embeds';
import { logger } from '../../infrastructure/logger/WinstonLogger';
import { describeError, commandDescription } from './shared';

export const startCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('start')
    .setDescription(commandDescription('Start the {server} Minecraft server')),

  // Enforced centrally by the interaction router.
  requiredPermission: PermissionLevel.TRUSTED,

  async execute(
    interaction: ChatInputCommandInteraction,
    services: ServiceContainer,
  ): Promise<void> {
    const state = services.currentState;

    if (state === ServerState.ONLINE) {
      await interaction.reply({
        embeds: [buildStatusEmbed(state, services.lastMinecraftStatus, services.serverOnlineAt)],
      });
      return;
    }

    if (state === ServerState.STARTING || state === ServerState.QUEUEING) {
      await interaction.reply({
        embeds: [buildErrorEmbed(`The server is already ${state.toLowerCase()}. Please wait.`)],
      });
      return;
    }

    await interaction.deferReply();

    try {
      await services.aternos.startServer();
      services.currentState = ServerState.STARTING;
      await interaction.editReply({ embeds: [buildStartingEmbed()] });
      logger.info(`/start invoked by ${interaction.user.tag}.`);

      // Fast-poll the launch and track it in a single progress message.
      services.beginLaunchWatch?.();
    } catch (err) {
      logger.error(`/start failed: ${String(err)}`);
      await interaction.editReply({
        embeds: [buildErrorEmbed(`Could not start the server: ${describeError(err)}`)],
      });
    }
  },
};
