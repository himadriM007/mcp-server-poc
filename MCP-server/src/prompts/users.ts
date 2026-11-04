import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { completable } from '@modelcontextprotocol/sdk/server/completable.js';
import { fetchUsers } from '../apiClient.js';

/** Suggests active user ids; returns nothing if the API is down. */
const completeUserId = async (value: string | undefined) => {
  try {
    return (await fetchUsers()).map((u) => String(u.id)).filter((id) => id.startsWith(value ?? ''));
  } catch {
    return [];
  }
};

const user = (text: string) => ({ role: 'user' as const, content: { type: 'text' as const, text } });

export function registerUserPrompts(server: McpServer): void {
  server.registerPrompt(
    'onboard_user',
    {
      title: 'Onboard a new user',
      description: 'Check the details, make sure the email is not already used, then add the user.',
      argsSchema: {
        name: z.string().describe('Full name'),
        email: z.string().describe('Email address'),
        address: z.string().describe('Postal address'),
        phone: z.string().optional().describe('Phone number (digits only, max 2147483647)'),
      },
    },
    ({ name, email, address, phone }) => ({
      messages: [
        user(
          [
            'Onboard this new user:',
            `- Name: ${name}`,
            `- Email: ${email}`,
            `- Address: ${address}`,
            `- Phone: ${phone || '(none)'}`,
            '',
            'Steps:',
            '1. Check the details look valid (real-looking name, valid email, phone is a whole number no larger than 2147483647).',
            '2. Call `get_users` and check no active user already has this email. Note the API also rejects emails held by inactive users.',
            '3. If everything is fine, call `add_user`. Otherwise explain what is wrong and stop.',
            '4. Report the new user id, or the error message from the API.',
          ].join('\n'),
        ),
      ],
    }),
  );

  server.registerPrompt(
    'deactivate_user',
    {
      title: 'Deactivate a user',
      description: 'Look up a user, confirm with the person, then soft-delete them.',
      argsSchema: {
        id: completable(z.string().describe('User id'), completeUserId),
        reason: z.string().optional().describe('Why the user is being removed'),
      },
    },
    ({ id, reason }) => ({
      messages: [
        user(
          [
            `I want to deactivate user ${id}${reason ? ` (reason: ${reason})` : ''}.`,
            '',
            `1. Call \`get_users\` with id ${id} and show me the user's name and email.`,
            '2. If no user is found, tell me and stop.',
            '3. Ask me to confirm. Only after I confirm, call `remove_user`.',
            '4. Report the result. Removal is a soft delete: the user is marked inactive, and their email cannot be reused.',
          ].join('\n'),
        ),
      ],
    }),
  );

  server.registerPrompt(
    'user_report',
    {
      title: 'User report',
      description: 'Summarize all active users, flagging incomplete or suspicious records.',
      argsSchema: {
        focus: z.string().optional().describe('Optional focus, e.g. "missing phone numbers" or "users in Kolkata"'),
      },
    },
    async ({ focus }) => {
      const instructions = [
        'Write a short report on the active users:',
        '- Total number of active users.',
        '- Users missing a phone number or address.',
        '- Possible duplicates (similar names or emails).',
        focus ? `- Pay particular attention to: ${focus}.` : '',
      ]
        .filter(Boolean)
        .join('\n');

      try {
        const users = await fetchUsers();
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'resource',
                resource: {
                  uri: 'users://all',
                  mimeType: 'application/json',
                  text: JSON.stringify(users, null, 2),
                },
              },
            },
            user(`The attached resource users://all lists every active user.\n\n${instructions}`),
          ],
        };
      } catch {
        // API unreachable when the prompt was built: let the model fetch the data itself.
        return { messages: [user(`Call \`get_users\` with no id to fetch every active user.\n\n${instructions}`)] };
      }
    },
  );
}
