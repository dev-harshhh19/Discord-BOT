import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand, PermissionLevel, ServiceContainer, ServerState } from '../../types';
import { buildRestartProgressEmbed, buildErrorEmbed } from '../components/embeds';
import { logger } from '../../infrastructure/logger/WinstonLogger';
import { sleep } from '../../utils/time';
import { describeError, commandDescription } from './shared';

/** Grace period between the stop request and the start request. */
const RESTART_SETTLE_MS = 8_000;

export const restartCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('restart')
    .setDescription(commandDescription('Restart the {server} server (owner only)')),

  requiredPermission: PermissionLevel.OWNER,

  async execute(
    interaction: ChatInputCommandInteraction,
    services: ServiceContainer,
  ): Promise<void> {
    await interaction.deferReply();

    try {
      await interaction.editReply({ embeds: [buildRestartProgressEmbed('stopping')] });
      logger.info(`/restart initiated by ${interaction.user.tag}.`);

      if (services.aternos.restartServer) {
        await services.aternos.restartServer();
      } else {
        if (
          services.currentState === ServerState.ONLINE ||
          services.currentState === ServerState.STARTING
        ) {
          await services.aternos.stopServer();
          services.currentState = ServerState.STOPPING;
          await sleep(RESTART_SETTLE_MS);
        }

        await interaction.editReply({ embeds: [buildRestartProgressEmbed('starting')] });
        logger.info('/restart phase 2 (start) initiated.');

        await services.aternos.startServer();
      }

      services.currentState = ServerState.STARTING;
      services.serverOnlineAt = null;

      logger.info('/restart completed.');
      services.beginLaunchWatch?.();
      await interaction.editReply({ embeds: [buildRestartProgressEmbed('starting')] });
    } catch (err) {
      logger.error(`/restart failed: ${String(err)}`);
      await interaction.editReply({
        embeds: [buildErrorEmbed(`Restart failed: ${describeError(err)}`)],
      });
    }
  },
};
