import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { BUTTON_IDS } from '../../types';

/**
 * Builds the dashboard interactive button row.
 * Start | Stop | Refresh
 */
export function buildDashboardButtons(isOnline: boolean): ActionRowBuilder<ButtonBuilder> {
  const startButton = new ButtonBuilder()
    .setCustomId(BUTTON_IDS.DASHBOARD_START)
    .setLabel('Start')
    .setStyle(ButtonStyle.Success)
    .setDisabled(isOnline);

  const stopButton = new ButtonBuilder()
    .setCustomId(BUTTON_IDS.DASHBOARD_STOP)
    .setLabel('Stop')
    .setStyle(ButtonStyle.Danger)
    .setDisabled(!isOnline);

  const refreshButton = new ButtonBuilder()
    .setCustomId(BUTTON_IDS.DASHBOARD_REFRESH)
    .setLabel('Refresh')
    .setStyle(ButtonStyle.Secondary);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(startButton, stopButton, refreshButton);
}

/**
 * Builds the stop confirmation button row.
 * Confirm | Cancel
 */
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
