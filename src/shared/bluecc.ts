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
    let targetCompanyIds = this.companyId ? [this.companyId] : [];

    // If no company ID is provided, fetch the available companies first
    // because projectList strictly requires companyIds
    if (targetCompanyIds.length === 0) {
      const companyQuery = `
        query GetCompanies {
          companies {
            items {
              id
            }
          }
        }
      `;
      const companyData = await this.request(companyQuery);
      if (companyData.companies?.items?.length > 0) {
        // Collect all available company IDs
        targetCompanyIds = companyData.companies.items.map((c: any) => c.id);
      } else {
        // If they don't belong to any company, they won't have workspaces
        return [];
      }
    }

    const query = `
      query GetWorkspaces($companyIds: [String!]!) {
        projectList(filter: { companyIds: $companyIds }, first: 50) {
          items {
            id
            name
            description
            archived
            updatedAt
          }
        }
      }
    `;
    const data = await this.request(query, { companyIds: targetCompanyIds });
    return data.projectList?.items || [];
  }

  async getWorkspaceContent(projectId: string) {
    const query = `
      query GetWorkspaceContent($projectId: String!) {
        project(id: $projectId) {
          id
          name
          description
          archived
        }
        todoLists(projectId: $projectId) {
          id
          title
        }
      }
    `;
    try {
      const data = await this.request(query, { projectId });
      
      // Because we want the todos for each list, and they might be paginated in TodosResult,
      // let's fetch todos for each list via the root todos query.
      let fullLists = data.todoLists || [];
      
      try {
        const listsWithTodos = await Promise.all(fullLists.map(async (list: any) => {
          const todosQuery = `
            query GetListTodos($listId: [String!]) {
              todos(filter: { todoListIds: $listId }, limit: 50) {
                items {
                  id
                  title
                  done
                }
              }
            }
          `;
          const todosData = await this.request(todosQuery, { listId: [list.id] });
          return {
            ...list,
            todos: todosData.todos?.items || []
          };
        }));
        fullLists = listsWithTodos;
      } catch (todoErr) {
        console.warn("Failed to fetch nested todos for lists", todoErr);
      }

      return {
        ...data.project,
        lists: fullLists
      };
    } catch (error) {
      console.error("Failed to fetch full workspace data:", error);
      // Fallback query if todoLists still fails
      const fallbackQuery = `
        query GetWorkspaceContentFallback($projectId: String!) {
          project(id: $projectId) {
            id
            name
            description
            archived
          }
        }
      `;
      const fallbackData = await this.request(fallbackQuery, { projectId });
      return { ...fallbackData.project, schemaError: (error as Error).message };
    }
  }

  async createWorkspace(name: string, description?: string) {
    if (!this.companyId) {
      throw new Error("A Company ID is strictly required by Blue.cc to create a workspace. Please add your Company ID in the Blue.cc Integration Settings panel first.");
    }

    const query = `
      mutation CreateWorkspace($input: CreateProjectInput!) {
        createProject(input: $input) {
          id
          name
        }
      }
    `;
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
