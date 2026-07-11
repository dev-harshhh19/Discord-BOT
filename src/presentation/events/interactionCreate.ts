import {
  Interaction,
} from 'discord.js';
import { ServiceContainer, BotCommand, PermissionLevel, BUTTON_IDS, ServerState } from '../../types';
import { checkButtonPermission } from '../../utils/permissions';
import { buildErrorEmbed, buildStartingEmbed, buildStoppingEmbed, buildStatusEmbed, buildStopConfirmEmbed } from '../components/embeds';
import { buildStopConfirmButtons, buildDashboardButtons } from '../components/buttons';
import { logger } from '../../infrastructure/logger/WinstonLogger';

export function createInteractionHandler(
  commands: Map<string, BotCommand>,
  services: ServiceContainer,
): (interaction: Interaction) => Promise<void> {
  return async (interaction: Interaction): Promise<void> => {
    // ── Slash Commands ────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const cmd = commands.get(interaction.commandName);
      if (!cmd) {
        logger.warn(`Unknown slash command received: /${interaction.commandName}`);
        return;
      }

      try {
        await cmd.execute(interaction, services);
      } catch (err) {
        logger.error(`Error in command /${interaction.commandName}: ${String(err)}`);
        const errorEmbed = buildErrorEmbed('An internal error occurred. Please try again later.');
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ embeds: [errorEmbed] });
        } else {
          await interaction.reply({ embeds: [errorEmbed], flags: 64 });
        }
      }
      return;
    }

    // ── Button Interactions ───────────────────────────────────────────────────
    if (interaction.isButton()) {
      const btn = interaction;

      try {
        switch (btn.customId) {
          case BUTTON_IDS.DASHBOARD_START: {
            if (!checkButtonPermission(btn, PermissionLevel.TRUSTED)) {
              await btn.reply({
                embeds: [buildErrorEmbed('You need Trusted Member access to start the server.')],
                flags: 64,
              });
              return;
            }

            if (
              services.currentState === ServerState.ONLINE ||
              services.currentState === ServerState.STARTING ||
              services.currentState === ServerState.QUEUEING
            ) {
              await btn.reply({
                embeds: [buildErrorEmbed(`Server is already ${services.currentState}.`)],
                flags: 64,
              });
              return;
            }

            await btn.deferReply({ flags: 64 });
            try {
              await services.aternos.startServer();
              services.currentState = ServerState.STARTING;
              await btn.editReply({ embeds: [buildStartingEmbed()] });
              logger.info(`Dashboard Start button clicked by ${btn.user.tag}`);
            } catch (err) {
              await btn.editReply({ embeds: [buildErrorEmbed(String(err))] });
            }
            break;
          }

          case BUTTON_IDS.DASHBOARD_STOP: {
            if (!checkButtonPermission(btn, PermissionLevel.ADMIN)) {
              await btn.reply({
                embeds: [buildErrorEmbed('You need Admin access to stop the server.')],
                flags: 64,
              });
              return;
            }

            // Show confirmation
            await btn.reply({
              embeds: [buildStopConfirmEmbed()],
              components: [buildStopConfirmButtons()],
              flags: 64,
            });
            break;
          }

          case BUTTON_IDS.DASHBOARD_REFRESH: {
            await btn.deferReply({ flags: 64 });
            await btn.editReply({
              embeds: [buildStatusEmbed(
                services.currentState,
                services.lastMinecraftStatus,
                services.serverOnlineAt,
              )],
            });
            break;
          }

          case BUTTON_IDS.STOP_CONFIRM: {
            if (!checkButtonPermission(btn, PermissionLevel.ADMIN)) {
              await btn.reply({
                embeds: [buildErrorEmbed('You do not have permission to confirm this.')],
                flags: 64,
              });
              return;
            }

            await btn.deferUpdate();
            try {
              await services.aternos.stopServer();
              services.currentState = ServerState.STOPPING;
              await btn.editReply({
                embeds: [buildStoppingEmbed()],
                components: [buildDashboardButtons(false)],
              });
              logger.info(`Stop confirmed via button by ${btn.user.tag}`);
            } catch (err) {
              await btn.editReply({
                embeds: [buildErrorEmbed(`Stop failed: ${String(err)}`)],
                components: [],
              });
            }
            break;
          }

          case BUTTON_IDS.STOP_CANCEL: {
            await btn.deferUpdate();
            await btn.editReply({
              embeds: [buildErrorEmbed('Stop cancelled.')],
              components: [],
            });
            break;
          }

          default:
            logger.warn(`Unknown button interaction: ${btn.customId}`);
        }
      } catch (err) {
        logger.error(`Error handling button ${btn.customId}: ${String(err)}`);
        // If we haven't replied yet, try to send an error message, but swallow any further API errors
        try {
          if (!btn.replied && !btn.deferred) {
            await btn.reply({ embeds: [buildErrorEmbed('An internal error occurred.')], flags: 64 });
          }
        } catch (replyErr) {
          logger.debug(`Could not send error reply for button ${btn.customId}: ${String(replyErr)}`);
        }
      }
    }
  };
}
