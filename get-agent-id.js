// Register agent and get agent_id using OAuth token
const PLAYGROUND_API_BASE = 'https://www.upwork.com/api/v3';
const OAUTH_TOKEN = 'your-oauth-token-here'; // Replace with actual token

async function registerAgent() {
  console.log('🤖 Registering agent...\n');

  const agentPayload = {
    "agent_name": "GSP_agent001",
    "base_url": "https://ai-gent-omega.vercel.app/",
    "category": "Web Development"
  };

  console.log('Payload:', JSON.stringify(agentPayload, null, 2));

  try {
    const response = await fetch(`${PLAYGROUND_API_BASE}/agents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OAUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(agentPayload)
    });

    console.log(`Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Success!');
      console.log('Full Response:', JSON.stringify(data, null, 2));

      // Extract agent IDs from different possible structures
      let agentIds = [];

      // If it's an array of agents
      if (Array.isArray(data)) {
        agentIds = data.map(agent => agent.id || agent.agent_id).filter(Boolean);
      }
      // If it's an object with agents array
      else if (data.agents && Array.isArray(data.agents)) {
        agentIds = data.agents.map(agent => agent.id || agent.agent_id).filter(Boolean);
      }
      // If it's a single agent object
      else if (data.id || data.agent_id) {
        agentIds = [data.id || data.agent_id];
      }
      // Check data wrapper
      else if (data.data) {
        if (Array.isArray(data.data)) {
          agentIds = data.data.map(agent => agent.id || agent.agent_id).filter(Boolean);
        } else if (data.data.id || data.data.agent_id) {
          agentIds = [data.data.id || data.data.agent_id];
        }
      }

      if (agentIds.length > 0) {
        console.log('\n🎯 Found agent_id(s):');
        agentIds.forEach((id, index) => {
          console.log(`  ${index + 1}. ${id}`);
        });

        if (agentIds.length === 1) {
          console.log(`\n✨ Your agent_id: ${agentIds[0]}`);
        }
      } else {
        console.log('\n❓ No agent_id found in response. Check the structure above.');
      }

      return data;

    } else {
      const errorText = await response.text();
      console.log(`❌ Failed: ${errorText}`);
      return null;
    }

  } catch (error) {
    console.error(`💥 Error: ${error.message}`);
    return null;
  }
}

registerAgent();