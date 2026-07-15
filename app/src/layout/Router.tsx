import { useNav } from '../store/nav';
import { useCurrentUser } from '../store/useCurrentUser';
import { ChairDashboard } from '../screens/ChairDashboard';
import { MemberDashboard } from '../screens/MemberDashboard';
import { AdminDashboard } from '../screens/AdminDashboard';
import { TeamOverview } from '../screens/TeamOverview';
import { Projects } from '../screens/Projects';
import { Meetings } from '../screens/Meetings';
import { ReqMeetings } from '../screens/ReqMeetings';
import { Actions } from '../screens/Actions';
import { Correspondence } from '../screens/Correspondence';
import { Committees } from '../screens/Committees';
import { ReportCenter } from '../screens/ReportCenter';
import { OfficeTasks } from '../screens/OfficeTasks';
import { TeamLeaves } from '../screens/TeamLeaves';
import { TeamWorkspace } from '../screens/TeamWorkspace';
import { Settings } from '../screens/Settings';

export function Router() {
  const { page } = useNav();
  const cu = useCurrentUser();

  switch (page) {
    case 'dashboard':
      return cu.type === 'chair' ? <ChairDashboard /> : cu.type === 'sysadmin' ? <AdminDashboard /> : <MemberDashboard />;
    case 'team':
      return <TeamOverview />;
    case 'projects':
    case 'projectDetail':
      return <Projects />;
    case 'meetings':
    case 'meetingDetail':
    case 'mtasks':
      return <Meetings />;
    case 'reqmeetings':
      return <ReqMeetings />;
    case 'actions':
      return <Actions />;
    case 'correspondence':
    case 'docDetail':
      return <Correspondence />;
    case 'committees':
      return <Committees />;
    case 'reportcenter':
    case 'reportDetail':
    case 'auditDetail':
    case 'finDetail':
    case 'reglog':
      return <ReportCenter />;
    case 'otasks':
      return <OfficeTasks />;
    case 'leaves':
      return <TeamLeaves />;
    case 'workspace':
      return <TeamWorkspace />;
    case 'settings':
      return <Settings />;
    default:
      return <ChairDashboard />;
  }
}
