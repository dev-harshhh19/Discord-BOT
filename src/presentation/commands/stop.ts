import { SlashCommandBuilder, ChatInputCommandInteraction, ComponentType, ButtonInteraction } from 'discord.js';
import { BotCommand, PermissionLevel, ServerState, ServiceContainer } from '../../types';
import { checkCommandPermission, checkButtonPermission } from '../../utils/permissions';
import {
  buildStopConfirmEmbed,
  buildStoppingEmbed,
  buildErrorEmbed,
} from '../components/embeds';
import { buildStopConfirmButtons } from '../components/buttons';
import { logger } from '../../infrastructure/logger/WinstonLogger';

const CONFIRM_TIMEOUT_MS = 30_000; // 30 seconds to confirm

export const stopCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop the TikdiSMP Minecraft server (requires confirmation)'),

  requiredPermission: PermissionLevel.ADMIN,

  async execute(
    interaction: ChatInputCommandInteraction,
    services: ServiceContainer,
  ): Promise<void> {
    if (!checkCommandPermission(interaction, PermissionLevel.ADMIN)) {
      await interaction.reply({
        embeds: [buildErrorEmbed('You do not have permission to stop the server.')],
        flags: 64,
      });
      return;
    }

    if (services.currentState !== ServerState.ONLINE) {
      await interaction.reply({
        embeds: [buildErrorEmbed(`Server is not online (current state: ${services.currentState}).`)],
        flags: 64,
      });
      return;
    }

    // Send confirmation prompt
    await interaction.reply({
      embeds: [buildStopConfirmEmbed()],
      components: [buildStopConfirmButtons()],
      flags: 64,
    });
    const response = await interaction.fetchReply();

    // Listen for button confirmation
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: CONFIRM_TIMEOUT_MS,
      filter: (btn: ButtonInteraction) => btn.user.id === interaction.user.id,
    });

    collector.on('collect', (btn: ButtonInteraction) => {
      void (async (): Promise<void> => {
      if (!checkButtonPermission(btn, PermissionLevel.ADMIN)) {
        await btn.reply({ content: 'You do not have permission to confirm this.', flags: 64 });
        return;
      }

      if (btn.customId === 'stop_confirm') {
        await btn.deferUpdate();

        try {
          await services.aternos.stopServer();
          services.currentState = ServerState.STOPPING;

          await interaction.editReply({
            embeds: [buildStoppingEmbed()],
            components: [],
          });
          logger.info(`/stop confirmed and executed by ${interaction.user.tag}`);
        } catch (err) {
          logger.error(`Failed to stop server: ${String(err)}`);
          await interaction.editReply({
            embeds: [buildErrorEmbed(`Failed to send stop command: ${String(err)}`)],
            components: [],
          });
        }
      } else if (btn.customId === 'stop_cancel') {
        await btn.deferUpdate();
        await interaction.editReply({
          embeds: [buildErrorEmbed('Stop cancelled.')],
          components: [],
        });
      }

      collector.stop();
      })();
    });

    collector.on('end', (_collected, reason) => {
      void (async (): Promise<void> => {
        if (reason === 'time') {
          try {
            await interaction.editReply({
              embeds: [buildErrorEmbed('Stop confirmation timed out. No action taken.')],
              components: [],
            });
          } catch {
            // Message may have already been edited
          }
        }
      })();
    });
  },
};
