import { MessageFlags } from 'discord.js';
import { BUTTON_IDS, ButtonHandler, PermissionLevel, ServerState } from '../../types';
import {
  buildErrorEmbed,
  buildStartingEmbed,
  buildStatusEmbed,
  buildStopConfirmEmbed,
  buildStoppingEmbed,
} from '../components/embeds';
import { buildStopConfirmButtons } from '../components/buttons';
import { logger } from '../../infrastructure/logger/WinstonLogger';

/**
 * The single registry of button behaviour.
 *
 * `/stop` previously attached its own `createMessageComponentCollector` *and*
 * the interaction router handled `stop_confirm` globally. Both fired on one
 * click, so `stopServer()` ran twice and the second `editReply` failed with
 * "interaction has already been acknowledged". Confirmation buttons are handled
 * here and nowhere else.
 */
export const buttonHandlers: ReadonlyMap<string, ButtonHandler> = new Map<string, ButtonHandler>([
  [
    BUTTON_IDS.DASHBOARD_START,
    {
      customId: BUTTON_IDS.DASHBOARD_START,
      requiredPermission: PermissionLevel.TRUSTED,
      async execute(interaction, services): Promise<void> {
        const state = services.currentState;
        if (
          state === ServerState.ONLINE ||
          state === ServerState.STARTING ||
          state === ServerState.QUEUEING
        ) {
          await interaction.reply({
            embeds: [buildErrorEmbed(`The server is already ${state.toLowerCase()}.`)],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
          await services.aternos.startServer();
          services.currentState = ServerState.STARTING;
          await interaction.editReply({ embeds: [buildStartingEmbed()] });
          logger.info(`Start requested from the dashboard by ${interaction.user.tag}.`);
          services.beginLaunchWatch?.();
        } catch (err) {
          await interaction.editReply({
            embeds: [buildErrorEmbed(`Could not start the server: ${describe(err)}`)],
          });
        }
      },
    },
  ],

  [
    BUTTON_IDS.DASHBOARD_STOP,
    {
      customId: BUTTON_IDS.DASHBOARD_STOP,
      requiredPermission: PermissionLevel.ADMIN,
      async execute(interaction, services): Promise<void> {
        if (services.currentState !== ServerState.ONLINE) {
          await interaction.reply({
            embeds: [
              buildErrorEmbed(
                `The server is not online (current state: ${services.currentState.toLowerCase()}).`,
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
    },
  ],

  [
    BUTTON_IDS.DASHBOARD_REFRESH,
    {
      customId: BUTTON_IDS.DASHBOARD_REFRESH,
      requiredPermission: PermissionLevel.EVERYONE,
      async execute(interaction, services): Promise<void> {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        // Ask the monitor for fresh data rather than echoing the cached state.
        services.forcePoll?.();
        await interaction.editReply({
          embeds: [
            buildStatusEmbed(
              services.currentState,
              services.lastMinecraftStatus,
              services.serverOnlineAt,
            ),
          ],
        });
      },
    },
  ],

  [
    BUTTON_IDS.STOP_CONFIRM,
    {
      customId: BUTTON_IDS.STOP_CONFIRM,
      requiredPermission: PermissionLevel.ADMIN,
      async execute(interaction, services): Promise<void> {
        await interaction.deferUpdate();
        try {
          await services.aternos.stopServer();
          services.currentState = ServerState.STOPPING;
          await interaction.editReply({ embeds: [buildStoppingEmbed()], components: [] });
          logger.info(`Stop confirmed by ${interaction.user.tag}.`);
          services.forcePoll?.();
        } catch (err) {
          await interaction.editReply({
            embeds: [buildErrorEmbed(`Could not stop the server: ${describe(err)}`)],
            components: [],
          });
        }
      },
    },
  ],

  [
    BUTTON_IDS.STOP_CANCEL,
    {
      customId: BUTTON_IDS.STOP_CANCEL,
      // The prompt is ephemeral, so only the requester can reach this button.
      requiredPermission: PermissionLevel.EVERYONE,
      async execute(interaction): Promise<void> {
        await interaction.deferUpdate();
        await interaction.editReply({
          embeds: [buildErrorEmbed('Stop cancelled. No action was taken.')],
          components: [],
        });
      },
    },
  ],
]);

/** Extracts a message safe to show a user, without leaking a stack trace. */
function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
