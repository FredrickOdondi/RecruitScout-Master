export class BlueCcClient {
  private baseUrl = 'https://api.blue.cc/graphql';

  constructor(
    private tokenId: string,
    private secretId: string,
    private companyId?: string
  ) {}

  async request<T = any>(query: string, variables: any = {}, projectId?: string): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Bloo-Token-ID': this.tokenId,
      'X-Bloo-Token-Secret': this.secretId,
    };

    if (this.companyId) {
      headers['X-Bloo-Company-ID'] = this.companyId;
    }
    if (projectId) {
      headers['X-Bloo-Project-ID'] = projectId;
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
            company {
              id
            }
          }
        }
      }
    `;
    const data = await this.request(query, { companyIds: targetCompanyIds });
    // Map the nested company.id to a flat companyId property for the UI to use
    return (data.projectList?.items || []).map((item: any) => ({
      ...item,
      companyId: item.company?.id
    }));
  }

  async getWorkspaceContent(projectId: string, overrideCompanyId?: string) {
    if (overrideCompanyId) {
      this.companyId = overrideCompanyId;
    } else {
      await this.ensureCompanyId();
    }
    
    // The correct way to fetch lists and their todos in Blue.cc is via the root todoLists query
    // This entirely bypasses the broken project(id) and projectList(ids) resolvers
    const query = `
      query GetWorkspaceContent($projectId: String!) {
        todoLists(projectId: $projectId) {
          id
          title
          todos {
            id
            title
            done
            position
            text
            commentCount
            tags {
              id
              title
              color
            }
          }
        }
      }
    `;
    
    try {
      // Must pass projectId as the third arg so X-Bloo-Project-ID is sent!
      const data = await this.request(query, { projectId }, projectId);
      
      const fullLists = data.todoLists || [];
      
      return {
        id: projectId,
        lists: fullLists.map((list: any) => ({
          ...list,
          todos: list.todos || []
        }))
      };
    } catch (err) {
      console.error('Failed to fetch full workspace data:', err);
      throw err;
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

  async getMentions(limit = 20) {
    const query = `
      query GetMentions($limit: Int) {
        mentions(filter: {}, limit: $limit) {
          items {
            id
            createdAt
            isRead
            mentioner {
              firstName
              lastName
            }
            targetWorkspace {
              id
              name
            }
          }
          pageInfo {
            totalItems
          }
        }
      }
    `;
    const data = await this.request(query, { limit });
    return {
      items: data.mentions?.items || [],
      total: data.mentions?.pageInfo?.totalItems || 0,
    };
  }

  /**
   * Fetch all comments (with nested replies) for a given todo card.
   * Uses the Blue.cc commentList query with category=TODO.
   */
  async getTodoComments(todoId: string, projectId?: string) {
    const query = `
      query GetTodoComments($categoryId: String!) {
        commentList(category: TODO, categoryId: $categoryId, first: 200) {
          totalCount
          comments {
            id
            text
            createdAt
            user {
              firstName
              lastName
            }
            replies {
              id
              text
              createdAt
              user {
                firstName
                lastName
              }
            }
          }
        }
      }
    `;
    const data = await this.request(query, { categoryId: todoId }, projectId);
    return {
      totalCount: data.commentList?.totalCount ?? 0,
      comments: data.commentList?.comments ?? [],
    };
  }

  /**
   * Create a new comment or reply to an existing one.
   * To comment on a todo: categoryId = todoId, category = 'TODO'
   * To reply to a comment: categoryId = commentId, category = 'COMMENT'
   */
  async createComment(categoryId: string, category: 'TODO' | 'COMMENT', text: string, projectId?: string) {
    const query = `
      mutation CreateComment($input: CreateCommentInput!) {
        createComment(input: $input) {
          id
          text
          createdAt
          user {
            firstName
            lastName
          }
        }
      }
    `;
    const data = await this.request(query, {
      input: {
        categoryId,
        category,
        text,
        html: `<p>${text}</p>`,
      }
    }, projectId);
    return data.createComment;
  }
}
