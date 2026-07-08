 import { Injectable, Controller, Post, Body, Module, Logger, HttpException, HttpStatus } from '@nestjs/common';

// ============================================================================
// CONTRATOS E INTERFACES DE DADOS
// ============================================================================

export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'agent' | 'condition' | 'webhook' | 'whatsapp_send';
  label: string;
  props: {
    prompt?: string;
    variable?: string;
    messageText?: string;
    url?: string;
    method?: 'GET' | 'POST';
  };
}

export interface WorkflowEdge {
  from: string;
  to: string;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export class ExecuteWorkflowDto {
  graph!: WorkflowGraph;
  inputMessage!: string;
  sessionId!: string;
}

// Para manter a compilação livre de erros de importação local
@Injectable()
class DummyPrismaService {
  cliente = {
    findFirst: async (args: any) => null as any,
    create: async (args: any) => ({ id: 'cli-native-123', nome: 'Paciente Simulado', telefone: '912345678' } as any),
  };
  proposta = {
    create: async (args: any) => ({ id: 'prop-native-123', numero: args.data.numero } as any),
  };
}

// ============================================================================
// SERVIÇO: MOTOR DE RESOLUÇÃO DE GRAFOS DE IA (WORKFLOW SERVICE)
// ============================================================================

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);
  private readonly geminiApiKey = process.env.GEMINI_API_KEY || '';
  private readonly modelName = 'gemini-2.5-flash-preview-09-2025';

  constructor(private readonly prisma: DummyPrismaService) {}

  public async execute(graph: WorkflowGraph, inputMessage: string, sessionId: string) {
    this.logger.log(`[Engine] Iniciando execução de fluxo. Sessão: ${sessionId}`);

    let cliente = await this.prisma.cliente.findFirst({
      where: { telefone: sessionId },
    });

    if (!cliente) {
      this.logger.log(`[Postgres] Cliente inexistente. Cadastrando: ${sessionId}`);
      cliente = await this.prisma.cliente.create({
        data: {
          nome: `Paciente Simulado ${sessionId.slice(-4)}`,
          telefone: sessionId,
          numero: 'S/N',
          complemento: 'Lead Capturado por IA',
        },
      });
    }

    const contextLogs: string[] = [];
    const variables: Record<string, any> = {
      patient_name: cliente.nome,
      phone: cliente.telefone,
      possui_convenio: true,
      last_sent_message: '',
    };

    const triggerNode = graph.nodes.find((n) => n.type === 'trigger');
    if (!triggerNode) {
      throw new HttpException('Gatilho de entrada ausente no fluxo de decisão.', HttpStatus.BAD_REQUEST);
    }

    let currentNodeId: string | undefined = triggerNode.id;

    while (currentNodeId) {
      const node = graph.nodes.find((n) => n.id === currentNodeId);
      if (!node) break;

      contextLogs.push(`[Fluxo] Ativando nó: "${node.label}" (${node.type})`);

      switch (node.type) {
        case 'trigger':
          currentNodeId = this.getNextNodeId(node.id, graph);
          break;

        case 'agent':
          const userQuery = variables['input_message'] || inputMessage;
          const systemPrompt = node.props.prompt || 'Você é o assistente virtual da Best Medical.';
          
          contextLogs.push(`[Gemini API] Solicitando inferência para o agente: ${node.label}`);
          const aiResponse = await this.callGeminiWithRetry(userQuery, systemPrompt);
          variables['last_ai_response'] = aiResponse;
          contextLogs.push(`[Gemini API] Resposta gerada.`);
          
          currentNodeId = this.getNextNodeId(node.id, graph);
          break;

        case 'condition':
          const variableToTest = node.props.variable || 'possui_convenio';
          const testVal = variables[variableToTest];
          contextLogs.push(`[Condicional] Testando variável: "${variableToTest}" (Valor: ${testVal})`);

          const branches = graph.edges.filter((e) => e.from === node.id);
          if (branches.length > 0) {
            if (testVal === true || testVal === 'sim') {
              currentNodeId = branches[0].to;
            } else if (branches.length > 1) {
              currentNodeId = branches[1].to;
            } else {
              currentNodeId = undefined;
            }
          } else {
            currentNodeId = undefined;
          }
          break;

        case 'whatsapp_send':
          const msg = node.props.messageText || 'Sua solicitação está sendo analisada.';
          variables['last_sent_message'] = msg;
          contextLogs.push(`[WhatsApp Gateway] Despachando notificação: "${msg}"`);
          
          currentNodeId = this.getNextNodeId(node.id, graph);
          break;

        case 'webhook':
          const url = node.props.url || 'https://api.bestmedical.app/v1/webhook';
          contextLogs.push(`[Webhook] Notificando API integrada: ${url}`);
          
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ variables }),
          }).catch((err) => this.logger.warn(`Falha na entrega segura do webhook: ${err.message}`));

          currentNodeId = this.getNextNodeId(node.id, graph);
          break;

        default:
          currentNodeId = undefined;
          break;
      }
    }

    if (variables['last_sent_message'] && variables['last_sent_message'].includes('orçamento')) {
      const novaProposta = await this.prisma.proposta.create({
        data: {
          numero: `ORC-AUTO-${Date.now()}`,
          clienteId: cliente.id,
          status: 'NOVA_DEMANDA',
          total: 0.0,
        },
      });
      contextLogs.push(`[Postgres CRM] Proposta de orçamento registrada automaticamente: ${novaProposta.numero}`);
    }

    return {
      success: true,
      logs: contextLogs,
      variables,
      reply: variables['last_sent_message'] || variables['last_ai_response'] || 'Automação processada.',
    };
  }

  private getNextNodeId(id: string, graph: WorkflowGraph): string | undefined {
    return graph.edges.find((e) => e.from === id)?.to;
  }

  private async callGeminiWithRetry(prompt: string, systemInstruction: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.geminiApiKey}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
    };

    let delay = 1000;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error(`HTTP Error Status: ${response.status}`);
        
        const data: any = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } catch (error) {
        if (attempt === 4) throw error;
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
    return '';
  }
}

// ============================================================================
// CONTROLADOR: EXPOSIÇÃO DAS APIS DO MOTOR (WORKFLOW CONTROLLER)
// ============================================================================

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

// ============================================================================
// MÓDULO NESTJS UNIFICADO (WORKFLOW MODULE)
// ============================================================================

@Module({
  controllers: [WorkflowController],
  providers: [WorkflowService, DummyPrismaService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
