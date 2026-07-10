const config = require('../../config.json');
const templatesConfig = require('../../templates.json');

const MONDAY_API_URL = 'https://api.monday.com/v2';

async function mondayQuery(query, variables) {
  const res = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: process.env.MONDAY_API_TOKEN,
      'API-Version': '2024-10',
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(JSON.stringify(json.errors));
  }
  return json.data;
}

function findTemplate(categoryKey, templateKey) {
  if (templateKey === 'custom' && (!categoryKey || !templatesConfig.categories[categoryKey])) {
    return templatesConfig.customTemplate;
  }
  const category = templatesConfig.categories[categoryKey];
  if (!category) return null;
  return category.templates.find((t) => t.key === templateKey) || null;
}

function buildUpdateBody(template, fields) {
  const lines = (template.fields || [])
    .map((f) => {
      const value = (fields && fields[f.id]) || '';
      return `<b>${f.label}:</b> ${value || '&mdash;'}`;
    })
    .join('<br>');

  const noteLine = template.assigneeNote ? `<br><br><i>${template.assigneeNote}</i>` : '';
  return lines + noteLine;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const {
      parentItemId,
      categoryKey,
      templateKey,
      templateLabel,
      fields,
      assigneeId,
      dueDate,
    } = JSON.parse(event.body);

    if (!parentItemId || !assigneeId || !dueDate || !templateKey) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required field' }) };
    }

    const template = findTemplate(categoryKey, templateKey);
    const subitemName = templateLabel || (template && template.label) || 'New task';

    const columnValues = {
      [config.subitemColumnIds.assignee]: { personsAndTeams: [{ id: Number(assigneeId), kind: 'person' }] },
      [config.subitemColumnIds.dueDate]: { date: dueDate },
      [config.subitemColumnIds.status]: { label: config.defaultStatus },
    };

    const created = await mondayQuery(
      `mutation ($parentItemId: ID!, $itemName: String!, $columnValues: JSON) {
        create_subitem(
          parent_item_id: $parentItemId
          item_name: $itemName
          column_values: $columnValues
          create_labels_if_missing: true
        ) {
          id
          name
          board { id }
        }
      }`,
      {
        parentItemId,
        itemName: subitemName,
        columnValues: JSON.stringify(columnValues),
      }
    );

    const newItemId = created.create_subitem.id;

    let updateBody;
    if (templateKey === 'custom') {
      updateBody = (fields && fields.details) ? fields.details.replace(/\n/g, '<br>') : '';
    } else if (template) {
      updateBody = buildUpdateBody(template, fields);
    } else {
      updateBody = '';
    }

    if (updateBody) {
      await mondayQuery(
        `mutation ($itemId: ID!, $body: String!) {
          create_update(item_id: $itemId, body: $body) {
            id
          }
        }`,
        { itemId: newItemId, body: updateBody }
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const parentColumnValues = {
      [config.parentItemColumnIds.assignee]: { personsAndTeams: [{ id: Number(assigneeId), kind: 'person' }] },
      [config.parentItemColumnIds.submissionDate]: { date: today },
      [config.parentItemColumnIds.dueDate]: { date: dueDate },
      [config.parentItemColumnIds.status]: { label: config.defaultStatus },
    };

    await mondayQuery(
      `mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
        change_multiple_column_values(
          board_id: $boardId
          item_id: $itemId
          column_values: $columnValues
          create_labels_if_missing: true
        ) {
          id
        }
      }`,
      {
        boardId: config.boardId,
        itemId: parentItemId,
        columnValues: JSON.stringify(parentColumnValues),
      }
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: created.create_subitem }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
