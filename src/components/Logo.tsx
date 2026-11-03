import LogoSvg from '../assets/logo.svg'
export function Logo() {
  return (
    <>
      <img alt="" width={30} height={30} src={LogoSvg} className={'fixed top-2 left-2 z-[999]'} />
      <p className={'font-[Virgil] fixed top-3 left-7 dark:text-white z-[999]'}>zlab</p>
    </>
  )
}
