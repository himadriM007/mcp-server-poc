import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import {
  ChatInfo,
  ChatToolInfo,
  ChatTurn,
  PendingToolCall,
  ToolStep,
} from './chat.model';

export class ResetChatDto {
  @ApiProperty({
    description: 'Client-generated id that keeps one conversation together',
    example: '3f1c2b9e-6a4d-4e1b-9c2f-1d2e3f4a5b6c',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sessionId: string;
}

export class ChatMessageDto extends ResetChatDto {
  @ApiProperty({
    description: 'The user message',
    example: 'Who are the active users?',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message: string;
}

export class ConfirmToolDto extends ResetChatDto {
  @ApiProperty({
    description: 'true runs the pending tool call, false declines it',
    example: true,
  })
  @IsBoolean()
  approve: boolean;
}

export class ToolStepDto implements ToolStep {
  @ApiProperty({ description: 'MCP tool name', example: 'get_users' })
  name: string;

  @ApiProperty({
    description: 'Arguments Gemini passed to the tool',
    type: 'object',
    additionalProperties: true,
    example: { id: 1 },
  })
  args: Record<string, unknown>;

  @ApiProperty({ enum: ['ok', 'error', 'declined'], example: 'ok' })
  status: 'ok' | 'error' | 'declined';

  @ApiProperty({ description: 'Text returned by the tool', example: '{...}' })
  result: string;
}

export class PendingToolCallDto implements PendingToolCall {
  @ApiProperty({ description: 'MCP tool name', example: 'remove_user' })
  name: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { id: 2 },
  })
  args: Record<string, unknown>;
}

export class ChatTurnDto implements ChatTurn {
  @ApiProperty({ type: [ToolStepDto] })
  steps: ToolStepDto[];

  @ApiPropertyOptional({
    description: 'Final answer (Markdown); set when the turn is finished',
    example: 'There are **3** active users.',
  })
  reply?: string;

  @ApiPropertyOptional({
    description:
      'Set when the turn is paused on a destructive tool call; answer with POST /chat/confirm',
    type: PendingToolCallDto,
  })
  confirm?: PendingToolCallDto;
}

export class ChatToolInfoDto implements ChatToolInfo {
  @ApiProperty({ example: 'remove_user' })
  name: string;

  @ApiProperty({ example: 'DELETE /users. Soft-deletes a user ...' })
  description: string;

  @ApiProperty({ description: 'Needs user approval before running' })
  destructive: boolean;
}

export class ChatInfoDto implements ChatInfo {
  @ApiProperty({ description: 'Gemini model id', example: 'gemini-3.8-flash' })
  model: string;

  @ApiProperty({ type: [ChatToolInfoDto] })
  tools: ChatToolInfoDto[];
}

export class ResetChatResponseDto {
  @ApiProperty({ example: true })
  ok: boolean;
}
