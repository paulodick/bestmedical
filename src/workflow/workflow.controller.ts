import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { WorkflowService, WorkflowGraph } from './workflow.service';

class ExecuteWorkflowDto {
  graph!: WorkflowGraph;
  inputMessage!: string;
  sessionId!: string;
}

@Controller('api/workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post('execute')
  async executeWorkflow(@Body() dto: ExecuteWorkflowDto) {
    try {
      return await this.workflowService.execute(dto.graph, dto.inputMessage, dto.sessionId);
    } catch (error: any) {
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}