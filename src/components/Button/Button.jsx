import {Link} from 'react-router-dom'; import './Button.css';
export default function Button({to,children,variant='primary',className='',type='button',...props}){const cls=`button ${variant} ${className}`; return to?<Link to={to} className={cls} {...props}>{children}<span>→</span></Link>:<button type={type} className={cls} {...props}>{children}<span>→</span></button>}
