import logo from '../../pictures/logo.jpeg';

export default function BrandLogo({ alt = 'Mauiza' }) {
  return <img className="td-brand-mark" src={logo} alt={alt} />;
}
