// Textos padrão (o Romário pode editar no painel). Linguagem simples, conforme a LGPD (Lei 13.709/2018).

export const DEFAULT_PRIVACY = (school: string, instructor: string) => `Política de Privacidade — ${school}

Quem cuida dos seus dados
${instructor} (${school}), em Salvador/BA, é o responsável pelos dados tratados neste app.

Quais dados coletamos
• Nome e celular: para identificar você, confirmar a aula e falar com você pelo WhatsApp.
• Senha: guardada de forma irreversível (criptografia de mão única). Ninguém consegue lê-la, nem o instrutor.
• Aulas, pagamentos e cancelamentos: para controlar sua agenda, seus créditos de pacote e eventuais devoluções.
• Nome de quem vai com você (aula em dupla), quando informado.
• Aparelho para notificações: um endereço técnico do navegador, só se você ativar os lembretes.
Não pedimos CPF, e-mail, endereço, documentos ou dados de cartão. O app não usa ferramentas de propaganda nem rastreamento.

Para que usamos (LGPD — Lei Geral de Proteção de Dados, Lei 13.709/2018)
Agendar, confirmar, lembrar e remarcar aulas; registrar pagamentos e devoluções; e cumprir obrigações legais. Base legal: execução do serviço que você contratou (art. 7º, V) e, para os lembretes, o seu consentimento (art. 7º, I).

Com quem compartilhamos
Com ninguém para fins comerciais. Os dados ficam em provedores de infraestrutura contratados (Cloudflare e Supabase), que só os armazenam e processam para o app funcionar. As notificações passam pelo serviço do seu navegador (Google, Apple ou Mozilla) de forma criptografada.

Por quanto tempo
Enquanto você tiver cadastro. Se você apagar a conta, nome, celular e senha são removidos na hora; o registro financeiro fica sem identificação pelo prazo exigido em lei.

Seus direitos
Você pode ver e corrigir seus dados no app, desativar os lembretes, pedir uma cópia ou apagar sua conta em Perfil → Apagar minha conta. Para qualquer pedido, fale com o instrutor pelo WhatsApp informado no app.

Segurança
Conexão criptografada (HTTPS), senha com hash forte, limite de tentativas de acesso, painel do instrutor com verificação em duas etapas e cópias de segurança criptografadas.

Alterações
Se esta política mudar, avisaremos no app.`;

export const DEFAULT_TERMS = (school: string) => `Termos de uso e responsabilidade — ${school}

1. O agendamento é confirmado com o pagamento do sinal. Sem o sinal no prazo, o horário é liberado.
2. Cancelamento pelo app dentro do prazo informado: o valor pago é devolvido pelo instrutor (aula avulsa) ou a aula volta como crédito (pacote). Fora do prazo, fale com o instrutor.
3. Compras de pacote feitas pelo app podem ser desistidas em até 7 dias (Código de Defesa do Consumidor, art. 49), com devolução dos valores pagos por aulas ainda não usadas.
4. O instrutor pode remarcar ou cancelar a aula por segurança (mar, vento, chuva forte). Nesse caso, você escolhe outra data ou recebe o valor de volta.
5. Surf é uma atividade física no mar. Informe ao instrutor qualquer condição de saúde, não entre na água sob efeito de álcool e siga as orientações de segurança. Menores de idade só com autorização de um responsável.
6. A prancha e o material são da escola. Danos por mau uso podem ser cobrados.`;
