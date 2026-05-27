export class BlueCcClient {
  private baseUrl = 'https://api.blue.cc/graphql';

  constructor(
    private tokenId: string,
    private secretId: string,
    private companyId?: string
  ) {}

  async request<T = any>(query: string, variables: any = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Bloo-Token-ID': this.tokenId,
      'X-Bloo-Token-Secret': this.secretId,
    };

    if (this.companyId) {
      headers['X-Bloo-Company-ID'] = this.companyId;
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    const result = await response.json();
    if (result.errors) {
      throw new Error(`Blue.cc GraphQL Error: ${result.errors.map((e: any) => e.message).join(', ')}`);
    }

    return result.data as T;
  }

  // Workspaces (Projects in Blue.cc schema)
  async getWorkspaces() {
    const query = `
      query GetWorkspaces {
        projectList(first: 50) {
          items {
            id
            name
            description
            isArchived
            updatedAt
            users {
              user {
                id
                firstName
                lastName
                email
              }
            }
          }
        }
      }
    `;
    const data = await this.request(query);
    return data.projectList?.items || [];
  }

  async getWorkspaceContent(projectId: string) {
    const query = `
      query GetWorkspaceContent($projectId: String!) {
        project(id: $projectId) {
          id
          name
          todoLists {
            id
            title
          }
          users {
            id
            role
            user {
              id
              email
            }
          }
        }
      }
    `;
    const data = await this.request(query, { projectId });
    return data.project;
  }

  async createWorkspace(name: string, description?: string) {
    const query = `
      mutation CreateWorkspace($input: CreateProjectInput!) {
        createProject(input: $input) {
          id
          name
        }
      }
    `;
    // Note: The exact input structure for CreateProjectInput requires 'name' and often 'companyId'.
    // We pass what we have. If it fails, the error will help us correct the exact fields.
    const data = await this.request(query, { 
      input: { 
        name,
        description,
        companyId: this.companyId
      } 
    });
    return data.createProject;
  }

  async updateWorkspace(projectId: string, name: string) {
    const query = `
      mutation EditWorkspace($input: EditProjectInput!) {
        editProject(input: $input) {
          id
          name
        }
      }
    `;
    const data = await this.request(query, { input: { id: projectId, name } });
    return data.editProject;
  }

  async archiveWorkspace(projectId: string) {
    const query = `
      mutation ArchiveWorkspace($id: String!) {
        archiveProject(id: $id)
      }
    `;
    const data = await this.request(query, { id: projectId });
    return data.archiveProject;
  }

  // Members Management
  async inviteUser(projectId: string, email: string) {
    // Note: inviteUser input fields typically include email and projectId
    const query = `
      mutation InviteUser($input: InviteUserInput!) {
        inviteUser(input: $input)
      }
    `;
    const data = await this.request(query, { input: { email, projectId } });
    return data.inviteUser;
  }

  async removeUser(projectId: string, userId: string) {
    const query = `
      mutation RemoveProjectUser($input: RemoveProjectUserInput!) {
        removeProjectUser(input: $input) {
          success
        }
      }
    `;
    const data = await this.request(query, { input: { projectId, userId } });
    return data.removeProjectUser;
  }

  // Webhooks
  async getWebhooks() {
    const query = `
      query GetWebhooks {
        webhooks {
          items {
            id
            url
            events
            isActive
          }
        }
      }
    `;
    const data = await this.request(query);
    return data.webhooks?.items || [];
  }

  async registerWebhook(projectId: string, url: string, events: string[] = ['*']) {
    const query = `
      mutation CreateWebhook($input: CreateWebhookInput!) {
        createWebhook(input: $input) {
          id
          url
        }
      }
    `;
    // CreateWebhookInput typically expects url, events, and potentially projectId
    const data = await this.request(query, { input: { url, events, projectId } });
    return data.createWebhook;
  }
}
