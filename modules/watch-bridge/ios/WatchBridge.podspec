Pod::Spec.new do |s|
  s.name           = 'WatchBridge'
  s.version        = '1.0.0'
  s.summary        = 'WatchConnectivity bridge for the gote Apple Watch app'
  s.description    = 'Pushes a small app-context snapshot (stats + mini-deck) to the paired Apple Watch.'
  s.author         = 'gote'
  s.homepage       = 'https://github.com/turbolya/gote'
  s.license        = { :type => 'AGPL-3.0-only' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => 'https://github.com/turbolya/gote.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files   = '**/*.{h,m,swift}'
end
