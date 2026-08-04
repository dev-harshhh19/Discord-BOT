import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { BUTTON_IDS, ServerState } from '../../types';

/**
 * Dashboard control row: Start | Stop | Refresh.
 *
 * Takes the full state rather than a boolean so transitional states are handled
 * correctly: while the server is STARTING, QUEUEING or STOPPING neither action
 * is valid, and the previous `isOnline` flag left Start enabled throughout a
 * start-up — inviting a second start request mid-queue.
 */
export function buildDashboardButtons(state: ServerState): ActionRowBuilder<ButtonBuilder> {
  const canStart = state === ServerState.OFFLINE || state === ServerState.CRASHED;
  const canStop = state === ServerState.ONLINE;

  const startButton = new ButtonBuilder()
    .setCustomId(BUTTON_IDS.DASHBOARD_START)
    .setLabel('Start')
    .setStyle(ButtonStyle.Success)
    .setDisabled(!canStart);

  const stopButton = new ButtonBuilder()
    .setCustomId(BUTTON_IDS.DASHBOARD_STOP)
    .setLabel('Stop')
    .setStyle(ButtonStyle.Danger)
    .setDisabled(!canStop);

  const refreshButton = new ButtonBuilder()
    .setCustomId(BUTTON_IDS.DASHBOARD_REFRESH)
    .setLabel('Refresh')
    .setStyle(ButtonStyle.Secondary);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(startButton, stopButton, refreshButton);
}

/** Stop confirmation row: Confirm | Cancel. */
export function buildStopConfirmButtons(): ActionRowBuilder<ButtonBuilder> {
  const confirmButton = new ButtonBuilder()
    .setCustomId(BUTTON_IDS.STOP_CONFIRM)
    .setLabel('Confirm Stop')
    .setStyle(ButtonStyle.Danger);

  const cancelButton = new ButtonBuilder()
    .setCustomId(BUTTON_IDS.STOP_CANCEL)
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Secondary);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);
}
