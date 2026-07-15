import { useNav } from '../store/nav';
import { ProjectsList } from './projects/ProjectsList';
import { ProjectDetail } from './projects/ProjectDetail';

export function Projects() {
  const { page } = useNav();
  return page === 'projectDetail' ? <ProjectDetail /> : <ProjectsList />;
}
