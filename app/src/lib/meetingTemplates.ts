export interface MeetingTemplate { id: string; label: string; icon: string; content: string }

export const MEETING_TEMPLATES: MeetingTemplate[] = [
  {
    id: 'standup',
    label: 'Standup',
    icon: '🔄',
    content: '## What I did\n- \n\n## What I\'m doing today\n- \n\n## Blockers\n- ',
  },
  {
    id: 'design-review',
    label: 'Design Review',
    icon: '🎨',
    content: '## Problem Statement\n\n## Proposed Solution\n\n## Trade-offs\n\n## Open Questions\n\n## Decision\n',
  },
  {
    id: 'test-debrief',
    label: 'Test Debrief',
    icon: '🧪',
    content: '## Test Objectives\n\n## Results\n\n## Issues Found\n\n## Root Cause\n\n## Next Steps\n',
  },
  {
    id: 'retrospective',
    label: 'Retrospective',
    icon: '↩',
    content: '## What went well\n- \n\n## What could be improved\n- \n\n## Action items\n- [ ] ',
  },
];
