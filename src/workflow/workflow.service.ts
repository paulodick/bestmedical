import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);
  private readonly geminiApiKey = process.env.GEMINI_API_KEY || '';
  private readonly modelName = 'gemini-2.5-flash-preview-09-2025';

  constructor(private readonly prisma: PrismaService) {}

  public async execute(graph: WorkflowGraph, inputMessage: string, sessionId: string) {
    this.logger.log(`Iniciando execucao do fluxo para a sessao: ${sessionId}`);

    // 1. Integracao Nativa Prisma: Localiza ou cria o cliente com base no telefone/sessao
    let cliente = await this.prisma.cliente.findFirst({
      where: { telefone: sessionId },
    });

    if (!cliente) {
      this.logger.log(`Cliente nao encontrado. Criando registro nativo no Postgres para: ${sessionId}`);
      cliente = await this.prisma.cliente.create({
        data: {
          nome: `Paciente Simulado ${sessionId.slice(-4)}`,
          telefone: sessionId,
          numero: 'S/N',
          complemento: 'Iniciado via Automação IA',
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
      throw new Error('O fluxo nao possui um no de Gatilho de Entrada.');
    }

    let currentNodeId: string | undefined = triggerNode.id;

    while (currentNodeId) {
      const node = graph.nodes.find((n) => n.id === currentNodeId);
      if (!node) break;

      contextLogs.push(`[Execucao] No activo: "${node.label}" (${node.type})`);

      switch (node.type) {
        case 'trigger':
          currentNodeId = this.getNextNodeId(node.id, graph);
          break;

        case 'agent':
          const userQuery = variables['input_message'] || inputMessage;
          const systemPrompt = node.props.prompt || 'Voce e um assistente da Best Medical.';
          
          contextLogs.push(`[IA] Chamando modelo Gemini para o agente: ${node.label}`);
          const aiResponse = await this.callGemini(userQuery, systemPrompt);
          variables['last_ai_response'] = aiResponse;
          contextLogs.push(`[IA] Resposta do agente gerada com sucesso.`);
          
          currentNodeId = this.getNextNodeId(node.id, graph);
          break;

        case 'condition':
          const variableToTest = node.props.variable || 'possui_convenio';
          const testVal = variables[variableToTest];
          contextLogs.push(`[Decisao] Testando condicional: ${variableToTest} (Valor: ${testVal})`);

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
          const msg = node.props.messageText || 'Obrigado pelo seu contato.';
          variables['last_sent_message'] = msg;
          contextLogs.push(`[WhatsApp] Mensagem despachada ao paciente: "${msg}"`);
          
          currentNodeId = this.getNextNodeId(node.id, graph);
          break;

        case 'webhook':
          const url = node.props.url || 'https://api.bestmedical.app/v1/webhook';
          contextLogs.push(`[Webhook] Enviando notificacao para: ${url}`);
          
          // Disparo HTTP asincrono e resiliente
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ variables }),
          }).catch((err) => this.logger.warn(`Erro no webhook asincrono: ${err.message}`));

          currentNodeId = this.getNextNodeId(node.id, graph);
          break;

        default:
          currentNodeId = undefined;
          break;
      }
    }

    // 2. Criacao Automatica de Proposta (Conexao Nativa com a tabela proposta do Prisma)
    if (variables['last_sent_message'] && variables['last_sent_message'].includes('orçamento')) {
      const novaProposta = await this.prisma.proposta.create({
        data: {
          numero: `ORC-IA-${Date.now()}`,
          clienteId: cliente.id,
          status: 'NOVA_DEMANDA',
          total: 0.0,
        },
      });
      contextLogs.push(`[CRM] Proposta nativa ${novaProposta.numero} criada no Postgres com sucesso.`);
    }

    return {
      success: true,
      logs: contextLogs,
      variables,
      reply: variables['last_sent_message'] || variables['last_ai_response'] || 'Mensagem processada.',
    };
  }

  private getNextNodeId(id: string, graph: WorkflowGraph): string | undefined {
    return graph.edges.find((e) => e.from === id)?.to;
  }

  private async callGemini(prompt: string, systemInstruction: string): Promise<string> {
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

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
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