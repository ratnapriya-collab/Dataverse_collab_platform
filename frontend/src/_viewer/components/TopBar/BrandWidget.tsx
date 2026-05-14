import logoUrl from '../../assets/logo.png'

export default function BrandWidget() {
  return (
    <div className="brand-widget">
      <div className="brand-logo">
        <img src={logoUrl} alt="AES" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
      <span className="brand-title">3D Viewer</span>
    </div>
  )
}
