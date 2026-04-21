import type { JobOffer } from '@/types/job'

export const backendRoleFixture: Pick<JobOffer, 'mandatorySkills' | 'niceToHaveSkills' | 'rawDescription' | 'keyResponsibilities'> = {
  rawDescription: 'Python backend role with FastAPI, PostgreSQL, Docker and CI/CD responsibilities.',
  keyResponsibilities: [
    'Build REST APIs with FastAPI',
    'Optimize PostgreSQL queries',
    'Deploy services using Docker',
  ],
  mandatorySkills: [
    { name: 'Python', mandatory: true, userHasSkill: true, userLevel: 'advanced', priority: 'primary', context: 'Core backend language' },
    { name: 'FastAPI', mandatory: true, userHasSkill: false, priority: 'primary', context: 'API framework' },
    { name: 'PostgreSQL', mandatory: true, userHasSkill: true, userLevel: 'intermediate', priority: 'secondary', context: 'Database layer' },
  ],
  niceToHaveSkills: [
    { name: 'Docker', mandatory: false, userHasSkill: false, priority: 'nice-to-have', context: 'Containerization' },
  ],
}
