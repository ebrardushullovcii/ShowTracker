Pod::Spec.new do |s|
  s.name = 'WatchlistWidgetStorage'
  s.version = '1.0.0'
  s.summary = 'Shares the Watchlist widget snapshot with WidgetKit'
  s.homepage = 'https://github.com/ebrardushullovcii/ShowTracker'
  s.license = { :type => 'MIT' }
  s.author = 'ShowTracker'
  s.platform = :ios, '15.1'
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WidgetKit'
  s.source_files = '**/*.swift'
end
