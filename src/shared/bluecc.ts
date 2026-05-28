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

  async ensureCompanyId() {
    if (!this.companyId || this.companyId.includes('.')) {
      // If no companyId or it looks like a domain name ("blue.cc"), auto-fetch the real one
      const companyQuery = `
        query GetCompanies {
          companies {
            items {
              id
            }
          }
        }
      `;
      // Temporarily clear invalid companyId to prevent the 'Company was not found' error during fetch
      const oldCompanyId = this.companyId;
      this.companyId = undefined; 
      try {
        const companyData = await this.request(companyQuery);
        if (companyData.companies?.items?.length > 0) {
          this.companyId = companyData.companies.items[0].id;
        } else {
          this.companyId = oldCompanyId; // restore if failed
        }
      } catch (err) {
        this.companyId = oldCompanyId;
      }
    }
  }

  // Workspaces (Projects in Blue.cc schema)
  async getWorkspaces() {
    await this.ensureCompanyId();
    const targetCompanyIds = this.companyId ? [this.companyId] : [];
    
    if (targetCompanyIds.length === 0) return [];

    const query = `
      query GetWorkspaces($companyIds: [String!]!) {
        projectList(filter: { companyIds: $companyIds }, first: 50) {
          items {
            id
            name
            description
            archived
            updatedAt
            companyId
          }
        }
      }
    `;
    const data = await this.request(query, { companyIds: targetCompanyIds });
    return data.projectList?.items || [];
  }

  async getWorkspaceContent(projectId: string, overrideCompanyId?: string) {
    if (overrideCompanyId) {
      this.companyId = overrideCompanyId;
    } else {
      await this.ensureCompanyId();
    }
    
    const query = `
      query GetWorkspaceContent($projectId: String!) {
        project(id: $projectId) {
          id
          name
          description
          archived
          todoLists {
            id
            title
          }
        }
      }
    `;
    try {
      const data = await this.request(query, { projectId });
      
      // Because we want the todos for each list, and they might be paginated in TodosResult,
      // let's fetch todos for each list via the root todos query.
      let fullLists = data.project?.todoLists || [];
      
      try {
        const listsWithTodos = await Promise.all(fullLists.map(async (list: any) => {
          let todos = [];
          try {
            // Attempt 1: Fetch rich data
            const richTodosQuery = `
              query GetRichListTodos($listId: [String!]) {
                todos(filter: { todoListIds: $listId }, limit: 50) {
                  items {
                    id
                    title
                    done
                    position
                    tags {
                      items {
                        id
                        name
                        color
                      }
                    }
                  }
                }
              }
            `;
            const todosData = await this.request(richTodosQuery, { listId: [list.id] });
            todos = todosData.todos?.items || [];
          } catch (richErr) {
            // Attempt 2: Fallback to basic data if the rich query fails due to schema differences
            console.warn("Rich query failed, falling back to basic query for list:", list.id);
            const basicTodosQuery = `
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
            const todosData = await this.request(basicTodosQuery, { listId: [list.id] });
            todos = todosData.todos?.items || [];
          }

          return {
            ...list,
            todos
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
    await this.ensureCompanyId();

    if (!this.companyId) {
      throw new Error("Could not automatically find your Company ID. Please add it manually in the settings.");
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
