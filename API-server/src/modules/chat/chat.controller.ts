import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import {
  ChatInfoDto,
  ChatMessageDto,
  ChatTurnDto,
  ConfirmToolDto,
  ResetChatDto,
  ResetChatResponseDto,
} from './chat.dto';
import { ChatInfo, ChatTurn } from './chat.model';

@ApiTags('chat')
@ApiBadRequestResponse({ description: 'The request failed validation.' })
@ApiServiceUnavailableResponse({
  description:
    'GEMINI_API_KEY or GEMINI_MODEL is missing, or the MCP server could not be started.',
})
@Controller()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('info')
  @ApiOperation({
    summary: 'Chat info',
    description:
      'Returns the Gemini model and the MCP tools the chatbot can use.',
  })
  @ApiOkResponse({ type: ChatInfoDto })
  info(): Promise<ChatInfo> {
    return this.chatService.info();
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a message',
    description:
      'Sends a message to the chatbot. Returns the reply, or a pending destructive tool call (confirm) that must be answered with POST /chat/confirm.',
  })
  @ApiOkResponse({ type: ChatTurnDto })
  @ApiConflictResponse({
    description: 'A confirmation is pending or the chat is busy.',
  })
  @ApiBadGatewayResponse({ description: 'Gemini returned an error.' })
  send(@Body() dto: ChatMessageDto): Promise<ChatTurn> {
    return this.chatService.send(dto.sessionId, dto.message);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve or decline a tool call',
    description: 'Resumes a turn that is paused on a destructive tool call.',
  })
  @ApiOkResponse({ type: ChatTurnDto })
  @ApiConflictResponse({ description: 'Nothing is waiting for confirmation.' })
  @ApiBadGatewayResponse({ description: 'Gemini returned an error.' })
  confirm(@Body() dto: ConfirmToolDto): Promise<ChatTurn> {
    return this.chatService.confirm(dto.sessionId, dto.approve);
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset a conversation',
    description: 'Forgets the history of a session.',
  })
  @ApiOkResponse({ type: ResetChatResponseDto })
  reset(@Body() dto: ResetChatDto): { ok: true } {
    return this.chatService.reset(dto.sessionId);
  }
}
